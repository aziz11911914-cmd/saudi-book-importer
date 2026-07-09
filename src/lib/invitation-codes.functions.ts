import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers (server-only, run inside handlers) ----------
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

// Base32 alphabet without confusables (no 0/O/1/I/L)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomSuffix(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
function makeCode(role: "owner" | "barber"): string {
  const prefix = role === "owner" ? "OWN" : "BAR";
  return `${prefix}-${randomSuffix(6)}`;
}

export const CODE_REGEX = /^(OWN|BAR)-[A-Z0-9]{6}$/;

// ---------- ADMIN: create ----------
const createSchema = z.object({
  role: z.enum(["owner", "barber"]),
  shop_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

export const createInvitationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.role === "barber" && !data.shop_id) {
      throw new Error("Barber codes require a salon.");
    }
    const expiresAt = new Date(
      Date.now() + (data.expires_in_days ?? 30) * 24 * 3600_000,
    ).toISOString();

    // Retry a few times on unique collision
    let lastErr: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = makeCode(data.role);
      const { data: row, error } = await context.supabase
        .from("invitation_codes")
        .insert({
          code,
          role: data.role,
          shop_id: data.shop_id ?? null,
          expires_at: expiresAt,
          notes: data.notes ?? null,
          created_by: context.userId,
        })
        .select("id, code, role, shop_id, status, expires_at, created_at")
        .single();
      if (!error) return row;
      lastErr = error;
      if (!String(error.message).toLowerCase().includes("duplicate")) break;
    }
    throw new Error(lastErr?.message ?? "Failed to create invitation code");
  });

// ---------- ADMIN: list ----------
export const listInvitationCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { role?: "owner" | "barber" } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("invitation_codes")
      .select(
        "id, code, role, shop_id, status, expires_at, used_at, activated_user_id, created_at, notes",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.role) q = q.eq("role", data.role);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];

    // hydrate shop names
    const shopIds = Array.from(new Set(rows.map((r: any) => r.shop_id).filter(Boolean)));
    let shops: Record<string, { name_en?: string; name_ar?: string }> = {};
    if (shopIds.length) {
      const { data: srows } = await context.supabase
        .from("shops")
        .select("id, name_en, name_ar")
        .in("id", shopIds);
      shops = Object.fromEntries((srows ?? []).map((s: any) => [s.id, s]));
    }
    return rows.map((r: any) => ({ ...r, shop: r.shop_id ? shops[r.shop_id] ?? null : null }));
  });

// ---------- ADMIN: revoke ----------
export const revokeInvitationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("invitation_codes")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PUBLIC: peek code (light validation before showing form) ----------
export const peekInvitationCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => ({
    code: z.string().trim().toUpperCase().regex(CODE_REGEX).parse(d.code),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("invitation_codes")
      .select("id, role, status, expires_at")
      .eq("code", data.code)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "invalid_code" as const };
    if (row.status === "revoked") return { ok: false as const, error: "revoked" as const };
    if (row.status === "activated") return { ok: false as const, error: "already_used" as const };
    if (new Date(row.expires_at).getTime() < Date.now())
      return { ok: false as const, error: "expired" as const };
    return { ok: true as const, role: row.role as "owner" | "barber" };
  });

// ---------- PUBLIC: activate (creates user, links role/shop, returns magic-link token) ----------
const activateSchema = z.object({
  code: z.string().trim().toUpperCase().regex(CODE_REGEX),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(255).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
});

export const activateInvitationCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => activateSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Re-validate code
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invitation_codes")
      .select("id, code, role, shop_id, status, expires_at")
      .eq("code", data.code)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!inv) return { ok: false as const, error: "invalid_code" as const };
    if (inv.status === "revoked") return { ok: false as const, error: "revoked" as const };
    if (inv.status === "activated")
      return { ok: false as const, error: "already_used" as const };
    if (new Date(inv.expires_at).getTime() < Date.now())
      return { ok: false as const, error: "expired" as const };

    // 2) Decide auth email. Prefer real email if unique; else synthetic.
    const syntheticEmail = `${inv.code.toLowerCase()}@codes.qassah.invite`;
    let authEmail = syntheticEmail;
    if (data.email) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (!existing) authEmail = data.email;
    }

    // 3) Create auth user (email auto-confirmed, random password)
    const password = crypto.randomUUID() + "!Aa1";
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      password,
      user_metadata: { full_name: data.full_name, invitation_code: inv.code },
    });
    if (createErr || !created?.user) {
      return { ok: false as const, error: (createErr?.message ?? "signup_failed") as any };
    }
    const userId = created.user.id;

    // 4) Activate via SECURITY DEFINER RPC (links role/shop/barber, marks code used)
    const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc(
      "activate_invitation_code" as any,
      {
        _code: inv.code,
        _user_id: userId,
        _full_name: data.full_name,
        _phone: data.phone,
        _email: data.email ?? authEmail,
      } as any,
    );
    if (rpcErr) {
      // Best-effort cleanup of dangling auth user
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(rpcErr.message);
    }
    const res = rpc as { ok: boolean; error?: string; role?: string };
    if (!res?.ok) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return { ok: false as const, error: (res?.error ?? "activation_failed") as any };
    }

    // 5) Generate magic-link token_hash to sign the user in without password
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      throw new Error(linkErr?.message ?? "Could not create sign-in link");
    }

    return {
      ok: true as const,
      role: (res.role ?? inv.role) as "owner" | "barber",
      token_hash: linkData.properties.hashed_token,
      email: authEmail,
    };
  });
