import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiDataResponse, StatsDtoGlobal } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface StatsState {
  status: "idle" | "loading" | "success" | "error";
  data?: StatsDtoGlobal;
  error?: ApiErrorViewModel;
}

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

export const useStatsGlobal = () => {
  const { request } = useApiClient();
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<StatsState>({ status: "idle" });

  const fetchStats = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading" });

    const result = await request<ApiDataResponse<StatsDtoGlobal>>("/api/stats?scope=global", {
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;

    if (result.error) {
      setState({ status: "error", error: result.error });
      return;
    }

    const data = result.data?.data;
    if (!data) {
      setState({ status: "error", error: invalidResponseError("Stats response is missing data.") });
      return;
    }

    setState({ status: "success", data });
  }, [request]);

  useEffect(() => {
    void fetchStats();
    return () => abortRef.current?.abort();
  }, [fetchStats]);

  return {
    ...state,
    refetch: fetchStats,
  };
};
