import { createFileRoute, useNavigate, useRouter, useSearch, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { ArrowRight, ArrowLeft, Loader2, Mail, ShieldCheck, User as UserIcon, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { sendAuthOtp, verifyAuthOtp } from "@/lib/auth-otp.functions";
import { activateInvitationCode, CODE_REGEX } from "@/lib/invitation-codes.functions";
import { useLocale } from "@/lib/locale-provider";
import { homeForRoles } from "@/lib/role-routing";
import { cn } from "@/lib/utils";

const search = z.object({
  redirect: z.string().optional().catch(undefined),
  email: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Sign in — Qassah" }] }),
  component: AuthPage,
});

type Step = "email" | "otp" | "name" | "activate";

const emailSchema = z.string().trim().email().max(255);

// Accepts codes like "OWN-ABC123" / "BAR-XYZ789" (case-insensitive, allow spaces/dashes typed by user)
function looksLikeCode(value: string): string | null {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");
  if (/^(OWN|BAR)[-\s]?[A-Z0-9]{6}$/.test(cleaned)) {
    const [prefix, rest] = [cleaned.slice(0, 3), cleaned.slice(-6)];
    const normalized = `${prefix}-${rest}`;
    if (CODE_REGEX.test(normalized)) return normalized;
  }
  return null;
}

function roleRedirect(roles: string[], explicit?: string): string {
  const home = homeForRoles(roles as any);
  if (explicit && explicit.startsWith("/")) {
    if (explicit.startsWith("/admin") && home !== "/admin") return home;
    if (explicit.startsWith("/owner") && home !== "/owner") return home;
    if (explicit.startsWith("/barber") && home !== "/barber") return home;
    return explicit;
  }
  return home;
}

function AuthPage() {
  const { t } = useTranslation();
  const { rtl, t: tt } = useLocale();
  const { ready, session, profile, roles, refresh } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect, email: emailParam } = useSearch({ from: "/auth" });
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const requestOtp = useServerFn(sendAuthOtp);
  const verifyOtp = useServerFn(verifyAuthOtp);
  const activate = useServerFn(activateInvitationCode);

  const [step, setStep] = useState<Step>("email");
  const [emailOrCode, setEmailOrCode] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Activation state
  const [pendingCode, setPendingCode] = useState<string>("");
  const [actFullName, setActFullName] = useState("");
  const [actPhone, setActPhone] = useState("");
  const [actEmail, setActEmail] = useState("");

  const email = looksLikeCode(emailOrCode) ? "" : emailOrCode;

  // Post-signin routing
  useEffect(() => {
    if (!ready || !session?.user) return;
    if (step === "name" || step === "activate") return;
    const needsName = !profile || (!profile.first_name && !profile.last_name && !profile.full_name);
    if (needsName) { setStep("name"); return; }
    navigate({ to: roleRedirect(roles, redirect) as any, replace: true });
  }, [ready, session, profile, roles, step, navigate, redirect]);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    const asCode = looksLikeCode(emailOrCode);
    if (asCode) {
      setPendingCode(asCode);
      setStep("activate");
      return;
    }
    const parsed = emailSchema.safeParse(emailOrCode);
    if (!parsed.success) {
      setError(tt("Enter a valid email or invitation code.", "أدخل بريدًا صالحًا أو رمز دعوة."));
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp({ data: { email: parsed.data } });
      setEmailOrCode(result.email);
      setCode("");
      setStep("otp");
      setInfo(tt("We sent a 6-digit code to your email.", "أرسلنا رمزًا من 6 أرقام إلى بريدك."));
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : tt("Could not send the code.", "تعذر إرسال الرمز."));
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) { setError(tt("Enter the 6-digit code.", "أدخل الرمز المكون من 6 أرقام.")); return; }
    setLoading(true);
    try {
      const result = await verifyOtp({ data: { email: emailOrCode, code: clean } });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (sessionError) throw sessionError;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tt("Invalid or expired code.", "رمز غير صالح أو منتهي."));
    } finally { setLoading(false); }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const first = firstName.trim();
    const last = lastName.trim();
    if (first.length < 1 || first.length > 60 || last.length > 60) {
      setError(tt("Please enter your name.", "يرجى إدخال اسمك.")); return;
    }
    if (!session?.user) { setError(tt("Session expired. Please sign in again.", "انتهت الجلسة.")); setStep("email"); return; }
    setLoading(true);
    const full = [first, last].filter(Boolean).join(" ");
    const { error: err } = await supabase.from("profiles").upsert(
      { id: session.user.id, email: session.user.email ?? null, first_name: first, last_name: last || null, full_name: full },
      { onConflict: "id" },
    );
    await supabase.auth.updateUser({ data: { first_name: first, last_name: last, full_name: full } });
    setLoading(false);
    if (err) { setError(err.message); return; }
    await refresh();
    router.invalidate();
    navigate({ to: roleRedirect(roles, redirect) as any, replace: true });
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!actFullName.trim() || !actPhone.trim()) {
      setError(tt("Please enter your name and phone.", "يرجى إدخال الاسم ورقم الهاتف.")); return;
    }
    if (actEmail && !emailSchema.safeParse(actEmail).success) {
      setError(tt("Please enter a valid email.", "يرجى إدخال بريد صالح.")); return;
    }
    setLoading(true);
    try {
      const res = await activate({ data: {
        code: pendingCode,
        full_name: actFullName.trim(),
        phone: actPhone.trim(),
        email: actEmail.trim() || undefined,
      }});
      if (!res.ok) {
        const map: Record<string, string> = {
          invalid_code: tt("Invalid invitation code.", "رمز دعوة غير صالح."),
          expired: tt("This invitation code has expired.", "انتهت صلاحية رمز الدعوة."),
          already_used: tt("This invitation code has already been used.", "تم استخدام رمز الدعوة مسبقًا."),
          revoked: tt("This invitation code has been revoked.", "تم إلغاء رمز الدعوة."),
        };
        setError(map[(res as any).error] ?? tt("Could not activate account.", "تعذر تفعيل الحساب."));
        setLoading(false);
        return;
      }
      // Sign in via magic link token_hash
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: res.token_hash,
      });
      if (verifyErr) throw verifyErr;
      await refresh();
      router.invalidate();
      const dest = res.role === "owner" ? "/owner" : res.role === "barber" ? "/barber" : "/";
      navigate({ to: dest as any, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : tt("Could not activate account.", "تعذر تفعيل الحساب."));
    } finally { setLoading(false); }
  }

  async function handleResend() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const result = await requestOtp({ data: { email: emailOrCode } });
      setEmailOrCode(result.email); setCode("");
      setInfo(tt("A new code is on the way.", "تم إرسال رمز جديد."));
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : tt("Could not resend the code.", "تعذر إعادة إرسال الرمز."));
    } finally { setLoading(false); }
  }

  const stepTitle = useMemo(() => {
    if (step === "email") return tt("Sign in to Qassah", "تسجيل الدخول إلى قَصّة");
    if (step === "otp") return tt("Enter your code", "أدخل الرمز");
    if (step === "activate") return tt("Activate your account", "تفعيل حسابك");
    return tt("Welcome — what's your name?", "أهلًا — ما اسمك؟");
  }, [step, tt]);

  const stepSub = useMemo(() => {
    if (step === "email") return tt("Enter your email — or your invitation code if you have one.", "أدخل بريدك الإلكتروني — أو رمز الدعوة إن وُجد.");
    if (step === "otp") return tt(`We sent a 6-digit code to ${email}.`, `أرسلنا رمزًا من 6 أرقام إلى ${email}.`);
    if (step === "activate") return tt(`Code ${pendingCode} — tell us a little about you.`, `الرمز ${pendingCode} — أخبرنا القليل عنك.`);
    return tt("This is the only time we'll ask.", "لن نسألك مرة أخرى بعد الآن.");
  }, [step, email, pendingCode, tt]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,rgba(212,175,55,0.18),transparent_55%)]" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="font-display text-xl text-gold">{t("brand")}</Link>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">{tt("Back to home", "العودة للرئيسية")}</Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col px-4 pb-16 pt-6 sm:px-6">
        <div className="rounded-3xl border border-hairline bg-surface/70 p-6 shadow-[0_30px_80px_-40px_rgba(212,175,55,0.35)] backdrop-blur sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full border border-gold/40 bg-background/40 text-gold">
              {step === "email" && <Mail className="size-5" />}
              {step === "otp" && <ShieldCheck className="size-5" />}
              {step === "name" && <UserIcon className="size-5" />}
              {step === "activate" && <KeyRound className="size-5" />}
            </span>
            <div>
              <h1 className="font-display text-2xl tracking-tight">{stepTitle}</h1>
              <p className="mt-1 text-xs text-muted-foreground">{stepSub}</p>
            </div>
          </div>

          {step === "email" && (
            <form onSubmit={handleContinue} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{tt("Email or invitation code", "البريد أو رمز الدعوة")}</span>
                <input
                  type="text"
                  autoComplete="email"
                  required
                  dir="ltr"
                  value={emailOrCode}
                  onChange={(e) => setEmailOrCode(e.target.value)}
                  placeholder="you@example.com  ·  OWN-XXXXXX"
                  className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none transition focus:border-gold/60"
                />
              </label>
              <SubmitButton loading={loading}>
                {tt("Continue", "متابعة")}
                <Arrow className="size-4" />
              </SubmitButton>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{tt("6-digit code", "الرمز")}</span>
                <input ref={codeRef} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} required dir="ltr"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition focus:border-gold/60" />
              </label>
              <SubmitButton loading={loading}>{tt("Verify and continue", "تحقق ومتابعة")}<Arrow className="size-4" /></SubmitButton>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); setInfo(null); }} className="text-muted-foreground hover:text-foreground">{tt("Change email", "تغيير البريد")}</button>
                <button type="button" onClick={handleResend} disabled={loading} className="text-gold hover:underline disabled:opacity-50">{tt("Resend code", "إعادة إرسال الرمز")}</button>
              </div>
            </form>
          )}

          {step === "activate" && (
            <form onSubmit={handleActivate} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{tt("Full name", "الاسم الكامل")} *</span>
                <input type="text" required value={actFullName} onChange={(e) => setActFullName(e.target.value)} maxLength={120}
                  className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-gold/60" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{tt("Phone number", "رقم الهاتف")} *</span>
                <input type="tel" required dir="ltr" value={actPhone} onChange={(e) => setActPhone(e.target.value)} maxLength={40}
                  className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-gold/60" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">{tt("Email (optional)", "البريد الإلكتروني (اختياري)")}</span>
                <input type="email" dir="ltr" value={actEmail} onChange={(e) => setActEmail(e.target.value)} maxLength={255}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-gold/60" />
              </label>
              <SubmitButton loading={loading}>{tt("Continue", "متابعة")}<Arrow className="size-4" /></SubmitButton>
              <button type="button" onClick={() => { setStep("email"); setPendingCode(""); setError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground">
                {tt("Use a different code or email", "استخدام رمز أو بريد آخر")}
              </button>
            </form>
          )}

          {step === "name" && (
            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-xs font-medium text-muted-foreground">{tt("First name", "الاسم الأول")}</span>
                  <input type="text" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60}
                    className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-gold/60" /></label>
                <label className="block"><span className="text-xs font-medium text-muted-foreground">{tt("Last name", "الاسم الأخير")}</span>
                  <input type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60}
                    className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-gold/60" /></label>
              </div>
              <SubmitButton loading={loading}>{tt("Finish", "إنهاء")}<Arrow className="size-4" /></SubmitButton>
            </form>
          )}

          {(error || info) && (
            <div role="status" className={cn("mt-4 rounded-2xl border px-4 py-3 text-xs",
              error ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-gold/30 bg-gold/5 text-gold")}>
              {error ?? info}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          {tt("By continuing you agree to our Terms and Privacy Policy.", "بمتابعتك أنت توافق على الشروط وسياسة الخصوصية.")}
        </p>
      </main>
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-gold-glow disabled:cursor-not-allowed disabled:opacity-60">
      {loading ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}
