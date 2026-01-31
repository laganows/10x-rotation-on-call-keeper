import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppNotifications } from "@/components/app/NotificationsProvider";

const variantStyles = {
  default: "border-border/50 bg-background text-foreground",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  error: "border-destructive/50 bg-destructive/5 text-destructive",
};

export const ToastViewport = () => {
  const { toasts, dismissToast } = useAppNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn("rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur", variantStyles[toast.variant])}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {toast.title ? <p className="font-medium">{toast.title}</p> : null}
              <p className={toast.title ? "mt-1" : undefined}>{toast.message}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => dismissToast(toast.id)}>
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
