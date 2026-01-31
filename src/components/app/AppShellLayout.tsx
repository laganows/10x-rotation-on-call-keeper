import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface AppShellLayoutProps {
  activePath: string;
  userLabel: string;
  onLogout: () => void;
  children: ReactNode;
}

const navItems = [
  { label: "Generator", href: "/" },
  { label: "Members", href: "/members" },
  { label: "Unavailabilities", href: "/unavailabilities" },
  { label: "Plans", href: "/plans" },
];

export const AppShellLayout = ({ activePath, userLabel, onLogout, children }: AppShellLayoutProps) => (
  <div className="min-h-screen bg-muted/40">
    <a
      href="#content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow"
    >
      Skip to content
    </a>
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Primary">
          {navItems.map((item) => {
            const isActive = activePath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-md px-2 py-1 transition-colors ${
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{userLabel}</span>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
    <main id="content" className="mx-auto w-full max-w-5xl px-6 py-8">
      {children}
    </main>
  </div>
);
