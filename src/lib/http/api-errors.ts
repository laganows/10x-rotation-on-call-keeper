import type { ApiErrorResponse } from "@/types";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

const isApiErrorResponse = (payload: unknown): payload is ApiErrorResponse => {
  if (!payload || typeof payload !== "object") return false;
  const error = (payload as ApiErrorResponse).error;
  return typeof error?.code === "string" && typeof error?.message === "string";
};

export const toApiErrorViewModel = (status: number, payload: unknown, fallbackMessage?: string): ApiErrorViewModel => {
  if (isApiErrorResponse(payload)) {
    const { code, message, details } = payload.error;
    return {
      status,
      code,
      message,
      details,
    };
  }

  const message = fallbackMessage ?? (status ? `Request failed with status ${status}.` : "Request failed.");
  return {
    status,
    code: "unknown_error",
    message,
  };
};

export const networkErrorToViewModel = (error: unknown): ApiErrorViewModel => {
  const message = error instanceof Error ? error.message : "Network error.";
  return {
    status: 0,
    code: "network_error",
    message,
    isNetworkError: true,
  };
};
