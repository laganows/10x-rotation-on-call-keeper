import { useCallback, useState } from "react";

import type { ApiDataResponse, PlanSavedSummaryDto, SavePlanCommand } from "@/types";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface SavePlanState {
  status: "idle" | "saving" | "saved" | "error";
  data?: PlanSavedSummaryDto;
  error?: ApiErrorViewModel;
}

const invalidResponseError = (message: string): ApiErrorViewModel => ({
  status: 500,
  code: "invalid_response",
  message,
});

export const useSavePlan = () => {
  const { request } = useApiClient();
  const [state, setState] = useState<SavePlanState>({ status: "idle" });

  const savePlan = useCallback(
    async (command: SavePlanCommand) => {
      setState({ status: "saving" });

      const result = await request<ApiDataResponse<PlanSavedSummaryDto>>("/api/plans", {
        method: "POST",
        body: command,
      });

      if (result.error) {
        setState({ status: "error", error: result.error });
        return { ok: false as const, error: result.error };
      }

      const summary = result.data?.data;
      if (!summary) {
        const error = invalidResponseError("Save response is missing data.");
        setState({ status: "error", error });
        return { ok: false as const, error };
      }

      setState({ status: "saved", data: summary });
      return { ok: true as const, data: summary };
    },
    [request]
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return {
    ...state,
    savePlan,
    reset,
  };
};
