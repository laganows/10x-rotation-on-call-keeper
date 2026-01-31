import type { ZodType } from "zod";

import type { ApiDataResponse, ApiErrorCode, ApiErrorResponse, ApiListResponse } from "../../types";

type JsonResponseBody = ApiDataResponse<unknown> | ApiListResponse<unknown> | ApiErrorResponse;

export const jsonResponse = (body: JsonResponseBody, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const errorResponse = (status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>) =>
  jsonResponse(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status
  );

export const parseJsonBody = async <T>(request: Request, schema: ZodType<T>, logContext?: string) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side error diagnostics
    console.error(`${logContext ?? "[api]"} invalid JSON body`, { error });
    return {
      ok: false as const,
      response: errorResponse(400, "validation_error", "Invalid JSON body."),
    };
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      ok: false as const,
      response: errorResponse(400, "validation_error", "Invalid request body.", result.error.flatten()),
    };
  }

  return { ok: true as const, data: result.data };
};
