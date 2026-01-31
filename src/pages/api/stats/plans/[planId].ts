import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../../db/supabase.client";
import { errorResponse, jsonResponse } from "../../../../lib/http/responses";
import { getPlanStats } from "../../../../lib/services/stats.service";
import { planIdParamSchema } from "../../../../lib/validation/stats.schema";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/stats] ${context}`, { userId, error });
};

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userId = DEFAULT_USER_ID;

  const planIdParsed = planIdParamSchema.safeParse(context.params.planId);

  if (!planIdParsed.success) {
    return errorResponse(400, "validation_error", "Invalid planId path parameter.", planIdParsed.error.flatten());
  }

  const result = await getPlanStats(supabase, userId, planIdParsed.data);

  if (result.error) {
    logServiceError("getPlanStats failed", userId, result.error);
    const status = result.error.code === "not_found" ? 404 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  return jsonResponse({ data: result.data }, 200);
};

