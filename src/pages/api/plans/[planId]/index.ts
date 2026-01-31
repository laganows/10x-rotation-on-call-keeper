import type { APIRoute } from "astro";

import { resolveUserId } from "../../../../lib/auth/auth.server";
import { errorResponse, jsonResponse } from "../../../../lib/http/responses";
import { getPlan } from "../../../../lib/services/plans.service";
import { planIdParamSchema } from "../../../../lib/validation/plans.schema";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/plans] ${context}`, { userId, error });
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

  const result = await getPlan(supabase, userId, planIdParsed.data);

  if (result.error) {
    logServiceError("getPlan failed", userId, result.error);
    const status = result.error.code === "not_found" ? 404 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  return jsonResponse({ data: result.data }, 200);
};
