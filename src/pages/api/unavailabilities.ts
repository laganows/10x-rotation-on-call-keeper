import type { APIRoute } from "astro";

import { resolveUserId } from "../../lib/auth/auth.server";
import { errorResponse, jsonResponse, parseJsonBody } from "../../lib/http/responses";
import { createUnavailability, listUnavailabilities } from "../../lib/services/unavailabilities.service";
import {
  createUnavailabilitySchema,
  unavailabilitiesCreateQuerySchema,
  unavailabilitiesListQuerySchema,
} from "../../lib/validation/unavailabilities.schema";
import type { ApiListResponse, UnavailabilityDto } from "../../types";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/unavailabilities] ${context}`, { userId, error });
};

const parseQuery = (request: Request) => {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
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

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const parsedQuery = unavailabilitiesListQuerySchema.safeParse(parseQuery(context.request));

  if (!parsedQuery.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters.", parsedQuery.error.flatten());
  }

  if (!isDateRangeValid(parsedQuery.data.startDate, parsedQuery.data.endDate)) {
    return errorResponse(400, "validation_error", "Invalid date range.");
  }

  const result = await listUnavailabilities(supabase, userId, parsedQuery.data);

  if (result.error) {
    logServiceError("listUnavailabilities failed", userId, result.error);
    const status = result.error.code === "not_found" ? 404 : result.error.code === "conflict" ? 409 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  const body: ApiListResponse<UnavailabilityDto> = {
    data: result.data.items,
    page: {
      limit: parsedQuery.data.limit ?? 50,
      offset: parsedQuery.data.offset ?? 0,
      total: result.data.total,
    },
  };

  return jsonResponse(body, 200);
};

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const parsedQuery = unavailabilitiesCreateQuerySchema.safeParse(parseQuery(context.request));

  if (!parsedQuery.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters.", parsedQuery.error.flatten());
  }

  const parsedBody = await parseJsonBody(context.request, createUnavailabilitySchema, "[api/unavailabilities]");

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const created = await createUnavailability(
    supabase,
    userId,
    parsedBody.data.memberId,
    parsedBody.data.day,
    parsedQuery.data.onConflict ?? "error"
  );

  if (created.error) {
    logServiceError("createUnavailability failed", userId, created.error);
    const status = created.error.code === "not_found" ? 404 : created.error.code === "conflict" ? 409 : 500;
    return errorResponse(status, created.error.code, created.error.message);
  }

  return jsonResponse({ data: created.data.item }, 201);
};
