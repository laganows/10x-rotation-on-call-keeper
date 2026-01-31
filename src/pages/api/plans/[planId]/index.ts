import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../../db/supabase.client";
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
  const userId = DEFAULT_USER_ID;

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
