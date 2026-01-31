import type { ApiErrorCode, PlanId } from "@/types";

export type RouteId = "login" | "setup" | "generator" | "members" | "unavailabilities" | "plans" | "planDetail" | "stats";

export interface RouteParams {
  planId?: PlanId;
}

export interface AuthSessionView {
  accessToken: string;
  userEmail: string | null;
}

export interface AuthState {
  authRequired: boolean;
  status: "loading" | "authenticated" | "anonymous";
  session: AuthSessionView | null;
}

export interface ApiErrorViewModel {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  isNetworkError?: boolean;
}

export interface AsyncState<T> {
  status: "idle" | "loading" | "success" | "error";
  data?: T;
  error?: ApiErrorViewModel;
}
