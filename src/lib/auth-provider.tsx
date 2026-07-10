import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { consumeMyInvites } from "@/lib/admin.functions";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type AuthProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
};

const PLATFORM_ADMIN_EMAIL = "abdulazizalodan1@gmail.com";

type AuthState = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const withTimeout = <T,>(promiseLike: PromiseLike<T>, ms = 3500) =>
  Promise.race<T>([
    Promise.resolve(promiseLike),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (currentUser: User) => {
    try {
      // Apply any pending invites (assigns owner/barber role and links to shop) + bumps last_login_at
      try { await withTimeout(consumeMyInvites()); } catch {}
      const [{ data: p }, { data: r }] = await Promise.all([
        withTimeout(supabase
          .from("profiles")
          .select("id,email,first_name,last_name,full_name,avatar_url,phone,status")
          .eq("id", currentUser.id)
          .maybeSingle()),
        withTimeout(supabase.from("user_roles").select("role").eq("user_id", currentUser.id)),
      ]);
      // Block disabled/suspended accounts from using the app.
      const status = (p as any)?.status;
      if (status === "disabled" || status === "suspended") {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setRoles([]);
        if (typeof window !== "undefined") {
          window.location.replace("/auth?disabled=1");
        }
        return;
      }
      setProfile((p as AuthProfile) ?? null);
      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
    } catch {
      if (currentUser?.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL) {
        setProfile({
          id: currentUser.id,
          email: currentUser.email,
          first_name: null,
          last_name: null,
          full_name: "Qassah Admin",
          avatar_url: null,
          phone: null,
        });
        setRoles(["super_admin" as AppRole]);
      }
    }
  }, []);


  const refresh = useCallback(async () => {
    try {
      const { data } = await withTimeout(supabase.auth.getSession());
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user);
      } else {
        setProfile(null);
        setRoles([]);
      }
    } catch {
      setSession(null);
      setProfile(null);
      setRoles([]);
    }
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;
    withTimeout(supabase.auth.getSession())
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setRoles([]);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_OUT" || !newSession?.user) {
        setProfile(null);
        setRoles([]);
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED"
      ) {
        // Defer to avoid potential deadlocks inside auth callback
        setTimeout(() => {
          loadProfile(newSession.user);
        }, 0);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      refresh,
      signOut,
    }),
    [ready, session, profile, roles, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      ready: false,
      session: null,
      user: null,
      profile: null,
      roles: [],
      refresh: async () => {},
      signOut: async () => {},
    };
  }
  return ctx;
}

export function displayName(profile: AuthProfile | null, fallback = ""): string {
  if (!profile) return fallback;
  const composed = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return composed || profile.full_name || profile.email || fallback;
}
