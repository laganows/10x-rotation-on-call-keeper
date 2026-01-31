import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";

export const LoginView = () => {
  const { state, loginWithOAuth } = useAuth();
  const isLoading = state.status === "loading";

  useEffect(() => {
    if (state.status !== "authenticated") return;
    if (typeof window === "undefined") return;
    window.location.assign("/");
  }, [state.status]);

  const handleLogin = async () => {
    await loginWithOAuth("github");
  };

  return (
    <main className="min-h-screen bg-muted/40 px-6 py-10">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Rotation On-Call Keeper</h1>
          <p className="text-sm text-muted-foreground">
            Log in with OAuth to access generator and plans.
          </p>
        </header>
        <Button onClick={handleLogin} disabled={isLoading}>
          Zaloguj sie
        </Button>
        {!state.authRequired ? (
          <p className="text-xs text-muted-foreground">
            Auth is optional in dev. You can also open the app without logging in.
          </p>
        ) : null}
      </div>
    </main>
  );
};
