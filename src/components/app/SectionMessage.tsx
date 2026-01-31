import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionMessageProps {
  title?: string;
  message: string;
  variant?: "info" | "error";
  action?: ReactNode;
}

export const SectionMessage = ({ title, message, variant = "info", action }: SectionMessageProps) => {
  const isError = variant === "error";

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        isError ? "border-destructive/50 bg-destructive/5 text-destructive" : "border-border/50 bg-muted/30 text-muted-foreground"
      )}
      role={isError ? "alert" : undefined}
    >
      {title ? <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{title}</p> : null}
      <p className={title ? "mt-1" : undefined}>{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
};
