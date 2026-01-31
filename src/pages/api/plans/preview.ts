import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../db/supabase.client";
import { errorResponse, jsonResponse, parseJsonBody } from "../../../lib/http/responses";
import { generatePlanPreview } from "../../../lib/services/plans.service";
import { planPreviewCommandSchema } from "../../../lib/validation/plans.schema";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/plans/preview] ${context}`, { userId, error });
};

const parseYyyyMmDdToUtcMs = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date.getTime();
};

const isDateRangeValid = (startDate: string, endDate: string) => {
  if (startDate > endDate) return false;
  const start = parseYyyyMmDdToUtcMs(startDate);
  const end = parseYyyyMmDdToUtcMs(endDate);
  if (start === null || end === null) return false;
  const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays >= 1 && diffDays <= 365;
};

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userId = DEFAULT_USER_ID;

  const parsedBody = await parseJsonBody(context.request, planPreviewCommandSchema, "[api/plans/preview]");

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  if (!isDateRangeValid(parsedBody.data.startDate, parsedBody.data.endDate)) {
    return errorResponse(422, "unprocessable_entity", "Invalid date range.");
  }

  const result = await generatePlanPreview(supabase, userId, parsedBody.data.startDate, parsedBody.data.endDate);

  if (result.error) {
    logServiceError("generatePlanPreview failed", userId, result.error);
    const status = result.error.code === "not_found" ? 404 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  return jsonResponse({ data: result.data }, 200);
};
