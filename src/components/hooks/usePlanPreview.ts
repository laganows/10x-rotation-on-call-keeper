import { useCallback, useRef, useState } from "react";

import type { ApiDataResponse, PlanPreviewDto, PlanPreviewCommand } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface PlanPreviewState {
  status: "idle" | "loading" | "success" | "error";
  data?: PlanPreviewDto;
  error?: ApiErrorViewModel;
  previewKey?: string;
}

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

const makePreviewKey = (command: PlanPreviewCommand) => `${command.startDate}|${command.endDate}`;

export const usePlanPreview = () => {
  const { request } = useApiClient();
  const cacheRef = useRef<Map<string, PlanPreviewDto>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<PlanPreviewState>({ status: "idle" });

  const generatePreview = useCallback(
    async (command: PlanPreviewCommand) => {
      const key = makePreviewKey(command);
      const cached = cacheRef.current.get(key);
      if (cached) {
        setState({ status: "success", data: cached, previewKey: key });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, status: "loading", error: undefined }));

      const result = await request<ApiDataResponse<PlanPreviewDto>>("/api/plans/preview", {
        method: "POST",
        body: command,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (result.error) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: result.error ?? invalidResponseError("Failed to generate preview."),
        }));
        return;
      }

      const preview = result.data?.data;
      if (!preview) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: invalidResponseError("Preview response is missing data."),
        }));
        return;
      }

      cacheRef.current.set(key, preview);
      setState({ status: "success", data: preview, previewKey: key });
    },
    [request]
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return {
    ...state,
    generatePreview,
    reset,
  };
};
