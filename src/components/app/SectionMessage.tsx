import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionMessageProps {
  title?: string;
  message: string;
  variant?: "info" | "error" | "success";
  action?: ReactNode;
}

const variantStyles = {
  info: "border-border/50 bg-muted/30 text-muted-foreground",
  error: "border-destructive/50 bg-destructive/5 text-destructive",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
};

const titleStyles = {
  info: "text-foreground",
  error: "text-destructive",
  success: "text-emerald-700",
};

export const SectionMessage = ({ title, message, variant = "info", action }: SectionMessageProps) => {
  const role = variant === "error" ? "alert" : undefined;

  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", variantStyles[variant])} role={role}>
      {title ? <p className={cn("font-medium", titleStyles[variant])}>{title}</p> : null}
      <p className={title ? "mt-1" : undefined}>{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
};
