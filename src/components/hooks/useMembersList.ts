import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiListResponse, MemberListItemDto, MembersListQuery } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface MembersListState {
  items: MemberListItemDto[];
  total: number;
  loading: boolean;
  error?: ApiErrorViewModel;
}

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

const buildQuery = (query: MembersListQuery) => {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  if (typeof query.limit === "number") params.set("limit", `${query.limit}`);
  if (typeof query.offset === "number") params.set("offset", `${query.offset}`);
  return params.toString();
};

export const useMembersList = (query: MembersListQuery) => {
  const { request } = useApiClient();
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<MembersListState>({
    items: [],
    total: 0,
    loading: false,
  });

  const queryString = useMemo(() => buildQuery(query), [query]);

  const fetchMembers = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    const result = await request<ApiListResponse<MemberListItemDto>>(`/api/members?${queryString}`, {
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;

    if (result.error) {
      setState((prev) => ({ ...prev, loading: false, error: result.error ?? undefined }));
      return;
    }

    const payload = result.data;
    if (!payload?.data || !payload.page) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: invalidResponseError("Members response is missing data."),
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
    void fetchMembers();
    return () => abortRef.current?.abort();
  }, [fetchMembers]);

  return {
    ...state,
    refetch: fetchMembers,
  };
};
