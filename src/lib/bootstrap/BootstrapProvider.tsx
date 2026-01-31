import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { ApiDataResponse, ProfileDto, TeamDto } from "@/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

export interface BootstrapState {
  status: "idle" | "loading" | "ready" | "needsSetup" | "error";
  profile?: ProfileDto;
  team?: TeamDto;
  error?: ApiErrorViewModel;
}

interface BootstrapContextValue {
  state: BootstrapState;
  refetch: () => Promise<void>;
}

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

const isNotFound = (error: ApiErrorViewModel | null) => Boolean(error && error.status === 404);

const isError = (error: ApiErrorViewModel | null) => Boolean(error && error.status !== 404);

const extractData = <T,>(payload: ApiDataResponse<T> | null | undefined) => {
  if (!payload) return null;
  if (!("data" in payload)) return null;
  return payload.data ?? null;
};

export const BootstrapProvider = ({ children }: { children: ReactNode }) => {
  const { request } = useApiClient();
  const { state: authState } = useAuth();
  const shouldFetch = !authState.authRequired || authState.status === "authenticated";
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<BootstrapState>({
    status: "loading",
  });

  const fetchBootstrap = useCallback(async () => {
    if (!shouldFetch) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: "loading", error: undefined }));

    const [profileResult, teamResult] = await Promise.all([
      request<ApiDataResponse<ProfileDto>>("/api/profile", { signal: controller.signal }),
      request<ApiDataResponse<TeamDto>>("/api/team", { signal: controller.signal }),
    ]);

    if (controller.signal.aborted) {
      return;
    }

    const profile = extractData(profileResult.data);
    const team = extractData(teamResult.data);

    if (!profile && !profileResult.error) {
      setState({
        status: "error",
        error: invalidResponseError("Profile response is missing data."),
      });
      return;
    }

    if (!team && !teamResult.error) {
      setState({
        status: "error",
        error: invalidResponseError("Team response is missing data."),
      });
      return;
    }

    if (isError(profileResult.error) || isError(teamResult.error)) {
      setState({
        status: "error",
        profile: profile ?? undefined,
        team: team ?? undefined,
        error: profileResult.error ?? teamResult.error ?? invalidResponseError("Bootstrap failed."),
      });
      return;
    }

    if (isNotFound(profileResult.error) || isNotFound(teamResult.error)) {
      setState({
        status: "needsSetup",
        profile: profile ?? undefined,
        team: team ?? undefined,
      });
      return;
    }

    setState({
      status: "ready",
      profile: profile ?? undefined,
      team: team ?? undefined,
    });
  }, [request, shouldFetch]);

  useEffect(() => {
    if (!shouldFetch) return;
    void fetchBootstrap();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchBootstrap, shouldFetch]);

  const value = useMemo<BootstrapContextValue>(
    () => ({
      state,
      refetch: fetchBootstrap,
    }),
    [state, fetchBootstrap]
  );

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
};

export const useBootstrap = () => {
  const context = useContext(BootstrapContext);
  if (!context) {
    throw new Error("useBootstrap must be used within BootstrapProvider.");
  }
  return context;
};
