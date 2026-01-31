import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiListResponse, UnavailabilityDto, UnavailabilitiesListQuery } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface UnavailabilitiesListState {
  items: UnavailabilityDto[];
  total: number;
  loading: boolean;
  error?: ApiErrorViewModel;
}

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

const buildQuery = (query: UnavailabilitiesListQuery) => {
  const params = new URLSearchParams();
  params.set("startDate", query.startDate);
  params.set("endDate", query.endDate);
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  if (typeof query.limit === "number") params.set("limit", `${query.limit}`);
  if (typeof query.offset === "number") params.set("offset", `${query.offset}`);
  return params.toString();
};

export const useUnavailabilitiesList = (query: UnavailabilitiesListQuery, enabled = true) => {
  const { request } = useApiClient();
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<UnavailabilitiesListState>({
    items: [],
    total: 0,
    loading: false,
  });

  const queryString = useMemo(() => buildQuery(query), [query]);

  const fetchUnavailabilities = useCallback(async () => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    const result = await request<ApiListResponse<UnavailabilityDto>>(`/api/unavailabilities?${queryString}`, {
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
        error: invalidResponseError("Unavailabilities response is missing data."),
      }));
      return;
    }

    setState({
      items: payload.data,
      total: payload.page.total ?? payload.data.length,
      loading: false,
    });
  }, [enabled, queryString, request]);

  useEffect(() => {
    void fetchUnavailabilities();
    return () => abortRef.current?.abort();
  }, [fetchUnavailabilities]);

  return {
    ...state,
    refetch: fetchUnavailabilities,
  };
};
