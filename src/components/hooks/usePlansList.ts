import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiListResponse, PlanDto, PlansListQuery } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface PlansListState {
  items: PlanDto[];
  total: number;
  loading: boolean;
  error?: ApiErrorViewModel;
}

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

const buildQuery = (query: PlansListQuery) => {
  const params = new URLSearchParams();
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  if (typeof query.limit === "number") params.set("limit", `${query.limit}`);
  if (typeof query.offset === "number") params.set("offset", `${query.offset}`);
  return params.toString();
};

export const usePlansList = (query: PlansListQuery) => {
  const { request } = useApiClient();
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<PlansListState>({
    items: [],
    total: 0,
    loading: false,
  });

  const queryString = useMemo(() => buildQuery(query), [query]);

  const fetchPlans = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    const result = await request<ApiListResponse<PlanDto>>(`/api/plans?${queryString}`, {
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;

    if (result.error) {
      setState((prev) => ({ ...prev, loading: false, error: result.error }));
      return;
    }

    const payload = result.data;
    if (!payload?.data || !payload.page) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: invalidResponseError("Plans response is missing data."),
      }));
      return;
    }

    setState({
      items: payload.data,
      total: payload.page.total ?? payload.data.length,
      loading: false,
    });
  }, [queryString, request]);

  useEffect(() => {
    void fetchPlans();
    return () => abortRef.current?.abort();
  }, [fetchPlans]);

  return {
    ...state,
    refetch: fetchPlans,
  };
};
