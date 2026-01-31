import type { APIRoute } from "astro";

import { resolveUserId } from "../../../../lib/auth/auth.server";
import { errorResponse, jsonResponse } from "../../../../lib/http/responses";
import { listPlanAssignments } from "../../../../lib/services/plans.service";
import { planAssignmentsListQuerySchema, planIdParamSchema } from "../../../../lib/validation/plans.schema";
import type { ApiListResponse, PlanAssignmentDto } from "../../../../types";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/plans] ${context}`, { userId, error });
};

const parseQuery = (request: Request) => {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
};

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const planIdParsed = planIdParamSchema.safeParse(context.params.planId);

  if (!planIdParsed.success) {
    return errorResponse(400, "validation_error", "Invalid planId path parameter.", planIdParsed.error.flatten());
  }

  const parsedQuery = planAssignmentsListQuerySchema.safeParse(parseQuery(context.request));

  if (!parsedQuery.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters.", parsedQuery.error.flatten());
  }

  const result = await listPlanAssignments(supabase, userId, planIdParsed.data, parsedQuery.data);

  if (result.error) {
    logServiceError("listPlanAssignments failed", userId, result.error);
    const status = result.error.code === "not_found" ? 404 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  const body: ApiListResponse<PlanAssignmentDto> = {
    data: result.data.items,
    page: {
      limit: parsedQuery.data.limit ?? 50,
      offset: parsedQuery.data.offset ?? 0,
      total: result.data.total,
    },
  };

  return jsonResponse(body, 200);
};
