import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../db/supabase.client";
import { errorResponse, jsonResponse, parseJsonBody } from "../../../lib/http/responses";
import { listPlans, savePlan } from "../../../lib/services/plans.service";
import { plansListQuerySchema, savePlanCommandSchema } from "../../../lib/validation/plans.schema";
import type { ApiListResponse, PlanDto } from "../../../types";

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
  const userId = DEFAULT_USER_ID;

  const parsedQuery = plansListQuerySchema.safeParse(parseQuery(context.request));

  if (!parsedQuery.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters.", parsedQuery.error.flatten());
  }

  const result = await listPlans(supabase, userId, parsedQuery.data);

  if (result.error) {
    logServiceError("listPlans failed", userId, result.error);
    const status = result.error.code === "not_found" ? 404 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  const body: ApiListResponse<PlanDto> = {
    data: result.data.items,
    page: {
      limit: parsedQuery.data.limit ?? 50,
      offset: parsedQuery.data.offset ?? 0,
      total: result.data.total,
    },
  };

  return jsonResponse(body, 200);
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
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
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

const enumerateDays = (startDate: string, endDate: string) => {
  const days: string[] = [];
  const start = parseYyyyMmDdToUtcMs(startDate);
  const end = parseYyyyMmDdToUtcMs(endDate);
  if (start === null || end === null) return days;
  const dayMs = 24 * 60 * 60 * 1000;

  for (let t = start; t <= end; t += dayMs) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }

  return days;
};

const validateAssignments = (
  startDate: string,
  endDate: string,
  assignments: { day: string; memberId: string | null }[]
) => {
  const days = enumerateDays(startDate, endDate);
  if (days.length === 0) {
    return "Invalid date range.";
  }

  if (assignments.length !== days.length) {
    return "Assignments do not cover the full date range.";
  }

  const expectedDays = new Set(days);
  const seenDays = new Set<string>();

  for (const assignment of assignments) {
    if (!expectedDays.has(assignment.day)) {
      return "Assignments contain day outside of date range.";
    }

    if (seenDays.has(assignment.day)) {
      return "Assignments contain duplicate days.";
    }

    seenDays.add(assignment.day);
  }

  return null;
};

const getTeamIdForOwner = async (
  supabase: typeof import("../../../db/supabase.client").supabaseClient,
  userId: string
) => {
  const { data, error } = await supabase.from("teams").select("team_id").eq("owner_id", userId).maybeSingle();
  if (error || !data) return null;
  return data.team_id;
};

const getActiveMemberIds = async (
  supabase: typeof import("../../../db/supabase.client").supabaseClient,
  teamId: string
) => {
  const { data, error } = await supabase
    .from("members")
    .select("member_id")
    .eq("team_id", teamId)
    .is("deleted_at", null);
  if (error) return null;
  return new Set((data ?? []).map((row) => row.member_id));
};

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userId = DEFAULT_USER_ID;

  const parsedBody = await parseJsonBody(context.request, savePlanCommandSchema, "[api/plans]");

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  if (!isDateRangeValid(parsedBody.data.startDate, parsedBody.data.endDate)) {
    return errorResponse(422, "unprocessable_entity", "Invalid date range.");
  }

  const assignmentsError = validateAssignments(
    parsedBody.data.startDate,
    parsedBody.data.endDate,
    parsedBody.data.assignments
  );

  if (assignmentsError) {
    return errorResponse(422, "unprocessable_entity", assignmentsError);
  }

  const teamId = await getTeamIdForOwner(supabase, userId);

  if (!teamId) {
    return errorResponse(404, "not_found", "Team not found.");
  }

  const activeMemberIds = await getActiveMemberIds(supabase, teamId);

  if (!activeMemberIds) {
    return errorResponse(500, "unprocessable_entity", "Failed to validate members.");
  }

  const invalidMember = parsedBody.data.assignments.find(
    (assignment) => assignment.memberId !== null && !activeMemberIds.has(assignment.memberId)
  );

  if (invalidMember) {
    return errorResponse(422, "unprocessable_entity", "Assignments contain invalid memberId.");
  }

  const result = await savePlan(supabase, userId, parsedBody.data);

  if (result.error) {
    logServiceError("savePlan failed", userId, result.error);
    const status = result.error.code === "conflict" ? 409 : result.error.code === "not_found" ? 404 : 500;
    return errorResponse(status, result.error.code, result.error.message);
  }

  return jsonResponse({ data: result.data }, 201);
};
