import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiDataResponse, StatsDtoPlan } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface StatsState {
  status: "idle" | "loading" | "success" | "error";
  data?: StatsDtoPlan;
  error?: ApiErrorViewModel;
}

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

export const useStatsPlan = (planId: string, enabled = true) => {
  const { request } = useApiClient();
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<StatsState>({ status: "idle" });

  const fetchStats = useCallback(async () => {
    if (!enabled) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading" });

    const result = await request<ApiDataResponse<StatsDtoPlan>>(`/api/stats/plans/${planId}`, {
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;

    if (result.error) {
      setState({ status: "error", error: result.error });
      return;
    }

    const data = result.data?.data;
    if (!data) {
      setState({ status: "error", error: invalidResponseError("Plan stats response is missing data.") });
      return;
    }

    setState({ status: "success", data });
  }, [enabled, planId, request]);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    void fetchStats();
    return () => abortRef.current?.abort();
  }, [enabled, fetchStats]);

  return {
    ...state,
    refetch: fetchStats,
  };
};
