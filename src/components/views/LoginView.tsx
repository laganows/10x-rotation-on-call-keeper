import { type FormEvent, useCallback, useEffect, useId, useState } from "react";

import { SectionMessage } from "@/components/app/SectionMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/http/api-client";

export const LoginView = () => {
  const { state, refreshSession } = useAuth();
  const { request } = useApiClient();
  const isLoading = state.status === "loading";
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const passwordId = `${baseId}-password`;

  useEffect(() => {
    if (state.status !== "authenticated") return;
    if (typeof window === "undefined") return;
    window.location.assign("/");
  }, [state.status]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;

      const form = event.currentTarget;
      const formData = new FormData(form);
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      if (!email || !password) {
        setErrorMessage("Wprowadz email i haslo.");
        return;
      }

      setErrorMessage(null);
      setIsSubmitting(true);

      const result = await request<null>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      if (result.error) {
        if (result.error.status === 401) {
          setErrorMessage("Nieprawidlowy email lub haslo.");
        } else {
          setErrorMessage(result.error.message ?? "Logowanie nie powiodlo sie.");
        }
        setIsSubmitting(false);
        return;
      }

      await refreshSession();

      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    },
    [isSubmitting, refreshSession, request]
  );

  return (
    <main className="min-h-screen bg-muted/40 px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-card p-8 text-card-foreground shadow-sm"
      >
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Zaloguj sie</h1>
          <p className="text-sm text-muted-foreground">Wprowadz email i haslo, aby przejsc do aplikacji.</p>
        </header>
        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={emailId}>Email</Label>
            <Input id={emailId} name="email" type="email" autoComplete="email" required disabled={isLoading || isSubmitting} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={passwordId}>Haslo</Label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isLoading || isSubmitting}
            />
          </div>
        </section>

        {errorMessage ? <SectionMessage variant="error" title="Logowanie nieudane" message={errorMessage} /> : null}

        <Button type="submit" disabled={isLoading || isSubmitting}>
          {isSubmitting ? "Logowanie..." : "Zaloguj sie"}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <a className="text-primary underline-offset-4 hover:underline" href="/register">
            Nie masz konta? Zarejestruj sie
          </a>
        </div>
        {!state.authRequired ? (
          <p className="text-xs text-muted-foreground">
            Auth is optional in dev. You can also open the app without logging in.
          </p>
        ) : null}
      </form>
    </main>
  );
};
