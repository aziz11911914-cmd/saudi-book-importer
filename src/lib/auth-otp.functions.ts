import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SITE_NAME = "Qassah";
const SENDER_DOMAIN = "notify.mail.taalemx.com";
const FROM_DOMAIN = "notify.mail.taalemx.com";
const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;

const requestOtpSchema = z.object({
  email: z.string().trim().email().max(255),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().regex(/^\d{6}$/),
});

const subjects: Record<string, string> = {
  signup: "Your Qassah verification code · رمز التحقق الخاص بك",
  magiclink: "Your Qassah sign-in code · رمز تسجيل الدخول",
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateSixDigitCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String((values[0]! % 900_000) + 100_000);
}

async function hashOtp(email: string, code: string, secret: string) {
  const encoded = new TextEncoder().encode(`${email}:${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function authHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function generateAuthTokenHash(email: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Authentication is temporarily unavailable.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: authHeaders(serviceKey),
    body: JSON.stringify({ type: "magiclink", email }),
  });

  if (!response.ok) {
    throw new Error("Could not generate a sign-in code. Please try again.");
  }

  const payload = (await response.json()) as {
    id?: string;
    hashed_token?: string;
    verification_type?: string;
  };

  if (!payload.hashed_token || !payload.verification_type) {
    throw new Error("Could not prepare sign-in verification. Please try again.");
  }

  return {
    userId: payload.id ?? null,
    tokenHash: payload.hashed_token,
    verificationType: payload.verification_type,
  };
}

async function renderOtpEmail({
  email,
  code,
  verificationType,
}: {
  email: string;
  code: string;
  verificationType: string;
}) {
  const React = await import("react");
  const { render } = await import("@react-email/components");
  const { SignupEmail } = await import("@/lib/email-templates/signup");
  const { MagicLinkEmail } = await import("@/lib/email-templates/magic-link");

  const EmailTemplate = verificationType === "signup" ? SignupEmail : MagicLinkEmail;
  const element = React.createElement(EmailTemplate, {
    siteName: SITE_NAME,
    token: code,
    recipient: email,
    expiryMinutes: OTP_TTL_MINUTES,
  });

  return {
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}

export const sendAuthOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => requestOtpSchema.parse(input))
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.LOVABLE_API_KEY;

    if (!supabaseUrl || !serviceKey || !apiKey) {
      throw new Error("Email sign-in is temporarily unavailable.");
    }

    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { userId, tokenHash, verificationType } = await generateAuthTokenHash(email);
    const code = generateSixDigitCode();
    const codeHash = await hashOtp(email, code, serviceKey);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // Don't revoke prior pending challenges — let any still-valid code work
    // until it's consumed or naturally expires. This avoids the "I entered the
    // first code but a second was requested" UX trap.

    const { error: challengeError } = await supabase.from("auth_otp_challenges").insert({
      email,
      user_id: userId,
      code_hash: codeHash,
      token_hash: tokenHash,
      verification_type: verificationType,
      expires_at: expiresAt,
    });

    if (challengeError) {
      throw new Error("Could not save the sign-in code. Please try again.");
    }

    const messageId = crypto.randomUUID();
    const templateName = verificationType === "signup" ? "signup" : "magiclink";
    const { html, text } = await renderOtpEmail({ email, code, verificationType });
    const emailPayload = {
      message_id: messageId,
      to: email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: subjects[templateName] ?? subjects.magiclink,
      html,
      text,
      purpose: "transactional" as const,
      label: templateName,
      idempotency_key: messageId,
      unsubscribe_token: crypto.randomUUID(),
      queued_at: new Date().toISOString(),
    };

    try {
      await sendLovableEmail(emailPayload, { apiKey });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: email,
        status: "sent",
      });
    } catch (error) {
      const { error: enqueueError } = await supabase.rpc("enqueue_email", {
        queue_name: "auth_emails",
        payload: emailPayload,
      });

      if (enqueueError) {
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: email,
          status: "failed",
          error_message: error instanceof Error ? error.message.slice(0, 1000) : "Email send failed",
        });
        throw new Error("Could not send the code. Please try again.");
      }

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: email,
        status: "pending",
        metadata: { fallback: "queued_after_direct_send_failure" },
      });
    }

    return {
      email,
      expiresInSeconds: OTP_TTL_MINUTES * 60,
    };
  });

export const verifyAuthOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => verifyOtpSchema.parse(input))
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const code = data.code;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !serviceKey || !publishableKey) {
      throw new Error("Email sign-in is temporarily unavailable.");
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const submittedHash = await hashOtp(email, code, serviceKey);

    // Find the challenge by email + code_hash — this lets any still-valid
    // unconsumed code work, even if a newer code was also requested.
    const { data: challenge, error: challengeError } = await supabase
      .from("auth_otp_challenges")
      .select("id, code_hash, token_hash, verification_type, expires_at, attempt_count")
      .eq("email", email)
      .eq("code_hash", submittedHash)
      .is("consumed_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError) {
      throw new Error("Could not verify the code. Please try again.");
    }

    if (!challenge) {
      // No matching code — bump attempt_count on the latest pending challenge
      // for rate-limiting, then surface a generic error.
      const { data: latest } = await supabase
        .from("auth_otp_challenges")
        .select("id, attempt_count")
        .eq("email", email)
        .is("consumed_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        const nextAttempts = latest.attempt_count + 1;
        await supabase
          .from("auth_otp_challenges")
          .update({
            attempt_count: nextAttempts,
            revoked_at: nextAttempts >= MAX_VERIFY_ATTEMPTS ? new Date().toISOString() : null,
          })
          .eq("id", latest.id);

        if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
          throw new Error("Too many invalid attempts. Please request a new code.");
        }
      }

      throw new Error("Invalid or expired code.");
    }

    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await supabase
        .from("auth_otp_challenges")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", challenge.id);
      throw new Error("This code has expired. Please request a new one.");
    }

    if (challenge.attempt_count >= MAX_VERIFY_ATTEMPTS) {
      await supabase
        .from("auth_otp_challenges")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", challenge.id);
      throw new Error("Too many invalid attempts. Please request a new code.");
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: challenge.verification_type,
        token_hash: challenge.token_hash,
      }),
    });

    if (!response.ok) {
      throw new Error("This code has expired. Please request a new one.");
    }

    const session = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };

    await supabase
      .from("auth_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    return {
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    };
  });