import type { ReactNode } from "react";

interface ViewPlaceholderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export const ViewPlaceholder = ({ title, description, children }: ViewPlaceholderProps) => (
  <main className="min-h-screen bg-muted/40 px-6 py-10">
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </div>
  </main>
);
