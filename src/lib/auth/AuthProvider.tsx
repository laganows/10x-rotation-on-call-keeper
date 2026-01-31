import type { Provider, Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AuthState } from "@/lib/view-models/ui";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase.browser";

interface AuthContextValue {
  state: AuthState;
  loginWithOAuth: (provider: Provider) => Promise<void>;
  logout: () => Promise<void>;
}

const parseAuthRequired = () => {
  const raw = import.meta.env.PUBLIC_AUTH_REQUIRED;
  if (!raw) return false;
  return raw === "true" || raw === "1";
};

const mapSession = (session: Session | null): AuthState["session"] => {
  if (!session) return null;
  return {
    accessToken: session.access_token,
    userEmail: session.user?.email ?? null,
  };
};

const AuthContext = createContext<AuthContextValue | null>(null);
const publicAuthPaths = new Set(["/login", "/register", "/recover"]);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const authRequired = parseAuthRequired();
  const [state, setState] = useState<AuthState>({
    authRequired,
    status: "loading",
    session: null,
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setState({ authRequired, status: "anonymous", session: null });
      return;
    }

    let isActive = true;

    const applySession = (session: Session | null) => {
      if (!isActive) return;
      const mappedSession = mapSession(session);
      setState({
        authRequired,
        status: mappedSession ? "authenticated" : "anonymous",
        session: mappedSession,
      });
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isActive) return;
        if (error) {
          // eslint-disable-next-line no-console -- auth diagnostics
          console.error("[auth] Failed to load session.", error);
          applySession(null);
          return;
        }
        applySession(data.session ?? null);
      })
      .catch((error) => {
        if (!isActive) return;
        // eslint-disable-next-line no-console -- auth diagnostics
        console.error("[auth] Failed to resolve session.", error);
        applySession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session ?? null);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [authRequired]);

  useEffect(() => {
    if (!authRequired) return;
    if (state.status !== "anonymous") return;
    if (typeof window === "undefined") return;

    if (!publicAuthPaths.has(window.location.pathname)) {
      window.location.assign("/login");
    }
  }, [authRequired, state.status]);

  const loginWithOAuth = useCallback(async (provider: Provider) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      // eslint-disable-next-line no-console -- auth diagnostics
      console.error("[auth] Supabase client not configured.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) {
      // eslint-disable-next-line no-console -- auth diagnostics
      console.error("[auth] OAuth sign-in failed.", error);
    }
  }, []);

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      // eslint-disable-next-line no-console -- auth diagnostics
      console.error("[auth] Logout failed.", error);
      return;
    }

    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      loginWithOAuth,
      logout,
    }),
    [state, loginWithOAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
};
