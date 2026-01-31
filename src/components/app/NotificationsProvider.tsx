import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { ApiErrorViewModel } from "@/lib/view-models/ui";

export type ToastVariant = "default" | "success" | "error";

export interface ToastInput {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface ToastItem extends ToastInput {
  id: string;
  variant: ToastVariant;
}

interface BannerError {
  message: string;
  status?: number;
}

interface NotificationsContextValue {
  bannerError: BannerError | null;
  toasts: ToastItem[];
  setBannerError: (error: BannerError | null) => void;
  clearBannerError: () => void;
  reportError: (error: ApiErrorViewModel | null) => void;
  pushToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
}

const flashToastKey = "rock:flashToast";

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const createToastId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.round(Math.random() * 1000)}`;
};

const isGlobalError = (error: ApiErrorViewModel) => error.isNetworkError || error.status >= 500;

export const setFlashToast = (toast: ToastInput) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(flashToastKey, JSON.stringify(toast));
  } catch {
    // ignore storage errors
  }
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [bannerError, setBannerError] = useState<BannerError | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const clearBannerError = useCallback(() => {
    setBannerError(null);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (toast: ToastInput) => {
      const id = createToastId();
      const item: ToastItem = {
        id,
        title: toast.title,
        message: toast.message,
        variant: toast.variant ?? "default",
        durationMs: toast.durationMs,
      };

      setToasts((prev) => [...prev, item]);

      const duration = toast.durationMs ?? 4000;
      if (duration > 0 && typeof window !== "undefined") {
        const timeoutId = window.setTimeout(() => dismissToast(id), duration);
        timeoutsRef.current.set(id, timeoutId);
      }
    },
    [dismissToast]
  );

  const reportError = useCallback((error: ApiErrorViewModel | null) => {
    if (!error) return;
    if (!isGlobalError(error)) return;
    setBannerError((prev) => {
      if (prev?.message === error.message) return prev;
      return { message: error.message, status: error.status };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(flashToastKey);
    if (!raw) return;
    sessionStorage.removeItem(flashToastKey);
    try {
      const toast = JSON.parse(raw) as ToastInput;
      if (toast?.message) {
        pushToast(toast);
      }
    } catch {
      // ignore malformed toast
    }
  }, [pushToast]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      bannerError,
      toasts,
      setBannerError,
      clearBannerError,
      reportError,
      pushToast,
      dismissToast,
    }),
    [bannerError, toasts, clearBannerError, dismissToast, pushToast, reportError]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useAppNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useAppNotifications must be used within NotificationsProvider.");
  }
  return context;
};
