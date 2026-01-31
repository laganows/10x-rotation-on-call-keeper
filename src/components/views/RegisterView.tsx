import { type FormEvent, useCallback, useState, useId } from "react";

import { setFlashToast } from "@/components/app/NotificationsProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const getFieldError = (error: ApiErrorViewModel | null, field: string) => {
  if (!error?.details || typeof error.details !== "object") return null;
  const details = error.details as { fieldErrors?: Record<string, string[]> };
  const fieldErrors = details.fieldErrors?.[field];
  if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) return null;
  return fieldErrors[0];
};

export const RegisterView = () => {
  const { request } = useApiClient();
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const passwordId = `${baseId}-password`;
  const confirmId = `${baseId}-confirm`;
  const noteId = `${baseId}-note`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [formError, setFormError] = useState<ApiErrorViewModel | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const isSubmitting = status === "submitting";

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFieldErrors({ email: "Email is required." });
      return;
    }

    if (!password) {
      setFieldErrors({ password: "Password is required." });
      return;
    }

    if (!confirmPassword) {
      setFieldErrors({ confirmPassword: "Confirm password is required." });
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setStatus("submitting");
    const result = await request<null>("/api/auth/register", {
      method: "POST",
      body: { email: trimmedEmail, password, confirmPassword },
    });

    if (result.error) {
      setFormError(result.error);
      setFieldErrors({
        email: getFieldError(result.error, "email") ?? undefined,
        password: getFieldError(result.error, "password") ?? undefined,
        confirmPassword: getFieldError(result.error, "confirmPassword") ?? undefined,
      });
      setStatus("idle");
      return;
    }

    setStatus("idle");
    setFlashToast({
      variant: "success",
      title: "Konto utworzone",
      message: "Mozesz sie teraz zalogowac. Jesli wymagane, sprawdz skrzynke email.",
    });

    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }, [confirmPassword, email, password, request]);

  return (
    <main className="min-h-screen bg-muted/40 px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-card p-8 text-card-foreground shadow-sm"
      >
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Utworz konto</h1>
          <p className="text-sm text-muted-foreground">
            Zarejestruj sie, aby uzyskac dostep do generatora i planow.
          </p>
        </header>

        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={emailId}>Email</Label>
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              required
            />
            {fieldErrors.email ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor={passwordId}>Haslo</Label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            {fieldErrors.password ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor={confirmId}>Powtorz haslo</Label>
            <Input
              id={confirmId}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              required
            />
            {fieldErrors.confirmPassword ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>
        </section>

        <p id={noteId} className="text-xs text-muted-foreground">
          Utworzenie konta moze wymagac potwierdzenia email.
        </p>

        {formError ? (
          <div
            className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {formError.message}
          </div>
        ) : null}

        <Button type="submit" aria-describedby={noteId} disabled={isSubmitting}>
          Utworz konto
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <a className="text-primary underline-offset-4 hover:underline" href="/login">
            Masz konto? Zaloguj sie
          </a>
          <a className="text-primary underline-offset-4 hover:underline" href="/recover">
            Odzyskaj konto
          </a>
        </div>
      </form>
    </main>
  );
};
