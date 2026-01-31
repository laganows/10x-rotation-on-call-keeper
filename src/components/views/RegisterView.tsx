import { type FormEvent, useCallback, useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const RegisterView = () => {
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const passwordId = `${baseId}-password`;
  const confirmId = `${baseId}-confirm`;
  const noteId = `${baseId}-note`;

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }, []);

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
            <Input id={emailId} name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={passwordId}>Haslo</Label>
            <Input id={passwordId} name="password" type="password" autoComplete="new-password" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={confirmId}>Powtorz haslo</Label>
            <Input id={confirmId} name="confirmPassword" type="password" autoComplete="new-password" required />
          </div>
        </section>

        <p id={noteId} className="text-xs text-muted-foreground">
          Integracja rejestracji bedzie dodana w kolejnym kroku.
        </p>

        <Button type="submit" aria-describedby={noteId}>
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
