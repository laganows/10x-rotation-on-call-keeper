import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiDataResponse, ApiListResponse, PlanAssignmentDto, PlanDto } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel, AsyncState } from "@/lib/view-models/ui";

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

const pageSize = 200;

const fetchAssignmentsPaged = async (
  request: (
    path: string,
    init?: RequestInit
  ) => Promise<{ data: ApiListResponse<PlanAssignmentDto> | null; error: ApiErrorViewModel | null }>,
  planId: string,
  signal: AbortSignal
) => {
  let offset = 0;
  let total = 0;
  const items: PlanAssignmentDto[] = [];
  let iterations = 0;

  while (true) {
    iterations += 1;
    if (iterations > 10) {
      return { items, error: invalidResponseError("Assignments pagination exceeded limit.") };
    }

    const result = await request(
      `/api/plans/${planId}/assignments?sort=day&order=asc&limit=${pageSize}&offset=${offset}`,
      { signal }
    );

    if (signal.aborted) {
      return { items: [], error: null };
    }

    if (result.error) {
      return { items: [], error: result.error };
    }

    const payload = result.data;
    if (!payload?.data || !payload.page) {
      return { items: [], error: invalidResponseError("Assignments response is missing data.") };
    }

    items.push(...payload.data);
    total = payload.page.total ?? items.length;

    if (items.length >= total || payload.data.length === 0) {
      break;
    }

    offset += pageSize;
  }

  return { items, error: null };
};

export const usePlanDetail = (planId: string, enabled = true) => {
  const { request } = useApiClient();
  const planAbortRef = useRef<AbortController | null>(null);
  const assignmentsAbortRef = useRef<AbortController | null>(null);

  const [planState, setPlanState] = useState<AsyncState<PlanDto>>({ status: "idle" });
  const [assignmentsState, setAssignmentsState] = useState<AsyncState<PlanAssignmentDto[]>>({ status: "idle" });

  const fetchPlan = useCallback(async () => {
    if (!enabled) return;

    planAbortRef.current?.abort();
    const controller = new AbortController();
    planAbortRef.current = controller;

    setPlanState({ status: "loading" });

    const result = await request<ApiDataResponse<PlanDto>>(`/api/plans/${planId}`, {
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;

    if (result.error) {
      setPlanState({ status: "error", error: result.error });
      return;
    }

    const plan = result.data?.data;
    if (!plan) {
      setPlanState({ status: "error", error: invalidResponseError("Plan response is missing data.") });
      return;
    }

    setPlanState({ status: "success", data: plan });
  }, [enabled, planId, request]);

  const fetchAssignments = useCallback(async () => {
    if (!enabled) return;

    assignmentsAbortRef.current?.abort();
    const controller = new AbortController();
    assignmentsAbortRef.current = controller;

    setAssignmentsState({ status: "loading" });

    const { items, error } = await fetchAssignmentsPaged(request, planId, controller.signal);

    if (controller.signal.aborted) return;

    if (error) {
      setAssignmentsState({ status: "error", error });
      return;
    }

    setAssignmentsState({ status: "success", data: items });
  }, [enabled, planId, request]);

  useEffect(() => {
    if (!enabled) {
      setPlanState({ status: "idle" });
      setAssignmentsState({ status: "idle" });
      return;
    }

    void fetchPlan();
    void fetchAssignments();

    return () => {
      planAbortRef.current?.abort();
      assignmentsAbortRef.current?.abort();
    };
  }, [enabled, fetchPlan, fetchAssignments]);

  const refetchAll = useMemo(
    () => () => {
      void fetchPlan();
      void fetchAssignments();
    },
    [fetchAssignments, fetchPlan]
  );

  return {
    planState,
    assignmentsState,
    refetchPlan: fetchPlan,
    refetchAssignments: fetchAssignments,
    refetchAll,
  };
};
