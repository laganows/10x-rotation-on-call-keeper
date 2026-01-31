import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../db/supabase.client";
import { errorResponse, jsonResponse } from "../../lib/http/responses";
import { getGlobalStats } from "../../lib/services/stats.service";
import { statsQuerySchema } from "../../lib/validation/stats.schema";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/stats] ${context}`, { userId, error });
};

const parseQuery = (request: Request) => {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
};

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userId = DEFAULT_USER_ID;

  const parsedQuery = statsQuerySchema.safeParse(parseQuery(context.request));

  if (!parsedQuery.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters.", parsedQuery.error.flatten());
  }

  if (parsedQuery.data.scope !== "global") {
    return errorResponse(400, "validation_error", "Unsupported scope.");
  }

  const result = await getGlobalStats(supabase, userId);

  if (result.error) {
    logServiceError("getGlobalStats failed", userId, result.error);
    const status = result.error.code === "not_found" ? 404 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  return jsonResponse({ data: result.data }, 200);
};

