import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Mail, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getInviteByToken, acceptInvite } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-provider";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Invitation — Qassah" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { ready, session, refresh } = useAuth();
  const fetchInvite = useServerFn(getInviteByToken);
  const accept = useServerFn(acceptInvite);

  const { data: invite, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite({ data: { token } }),
  });

  const [accepting, setAccepting] = useState(false);
  const [acceptErr, setAcceptErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ role?: string } | null>(null);

  // Auto-accept once signed-in user lands here with a valid pending invite
  useEffect(() => {
    if (!ready || !session?.user || !invite || invite.status !== "pending" || accepting || done) return;
    const signedInEmail = session.user.email?.toLowerCase();
    if (signedInEmail && signedInEmail !== invite.email.toLowerCase()) return;
    (async () => {
      setAccepting(true);
      try {
        const res = await accept({ data: { token } });
        if (!res.ok) {
          setAcceptErr(humanizeError(res.error, res.expected));
          return;
        }
        await refresh();
        setDone({ role: res.role });
        setTimeout(() => {
          navigate({ to: (res.role === "owner" ? "/owner" : res.role === "barber" ? "/barber" : "/") as any, replace: true });
        }, 1200);
      } catch (e: any) {
        setAcceptErr(e?.message ?? "Failed to accept invitation");
      } finally {
        setAccepting(false);
      }
    })();
  }, [ready, session, invite, accepting, done, accept, refresh, navigate, token]);

  if (isLoading) {
    return <Center><Loader2 className="size-6 animate-spin text-gold" /></Center>;
  }

  if (!invite) {
    return (
      <InviteShell icon={<AlertTriangle className="size-6 text-red-400" />} title="Invitation not found">
        <p>This invitation link is invalid or has been removed.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-gold underline">Back to home</Link>
      </InviteShell>
    );
  }

  if (invite.status === "revoked") {
    return <Status icon={<AlertTriangle className="size-6 text-red-400" />} title="Invitation revoked"
      body="This invitation has been cancelled by the administrator." />;
  }
  if (invite.status === "expired") {
    return <Status icon={<AlertTriangle className="size-6 text-amber-400" />} title="Invitation expired"
      body="This invitation has expired. Please request a new one." />;
  }
  if (invite.status === "accepted") {
    return <Status icon={<CheckCircle2 className="size-6 text-emerald-400" />} title="Invitation already used"
      body="This invitation has already been accepted." />;
  }

  const wrongEmail = session?.user?.email && session.user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <InviteShell icon={<ShieldCheck className="size-6 text-gold" />} title="You're invited to Qassah">
      <div className="space-y-3 rounded-2xl border border-hairline bg-background/40 p-4 text-sm">
        <Row label="Role"><span className="capitalize">{invite.role}</span></Row>
        {invite.shop_name_en || invite.shop_name_ar ? (
          <Row label="Salon">{invite.shop_name_en || invite.shop_name_ar}</Row>
        ) : null}
        <Row label="For"><span dir="ltr">{invite.email}</span></Row>
        <Row label="Expires">{new Date(invite.expires_at).toLocaleString()}</Row>
      </div>

      {done ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" /> Welcome! Redirecting you to your dashboard…
        </div>
      ) : acceptErr ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {acceptErr}
        </div>
      ) : !session?.user ? (
        <Link
          to="/auth"
          search={{ redirect: `/invite/${token}`, email: invite.email } as any}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          <Mail className="size-4" />
          Continue to sign in
        </Link>
      ) : wrongEmail ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          You're signed in as <span dir="ltr">{session.user.email}</span>, but this invitation is for <span dir="ltr">{invite.email}</span>. Please sign out and sign in with the invited email.
        </div>
      ) : accepting ? (
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Accepting invitation…
        </div>
      ) : null}
    </InviteShell>
  );
}

function humanizeError(code?: string, expected?: string) {
  switch (code) {
    case "expired": return "This invitation has expired.";
    case "revoked": return "This invitation has been revoked.";
    case "already_used": return "This invitation has already been used.";
    case "wrong_email": return `This invitation is for ${expected ?? "another email"}. Please sign in with that email.`;
    case "not_authenticated": return "Please sign in to accept this invitation.";
    case "invalid_token": return "Invalid invitation link.";
    default: return code ?? "Unable to accept invitation.";
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background">{children}</div>;
}
function InviteShell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-hairline bg-surface/70 p-6 shadow-[0_30px_80px_-40px_rgba(212,175,55,0.35)] backdrop-blur sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full border border-gold/40 bg-background/40">{icon}</span>
          <h1 className="font-display text-2xl">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
function Status({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <InviteShell icon={icon} title={title}>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Link to="/" className="mt-5 inline-block text-sm text-gold underline">Back to home</Link>
    </InviteShell>
  );
}
