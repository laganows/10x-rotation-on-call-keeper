import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));

Select.displayName = "Select";

export { Select };
