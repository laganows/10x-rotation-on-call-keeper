import type { APIRoute } from "astro";

import { resolveUserId } from "../../lib/auth/auth.server";
import { errorResponse, jsonResponse, parseJsonBody } from "../../lib/http/responses";
import { createTeamForOwner, getTeamByOwnerId, updateTeamNameByOwnerId } from "../../lib/services/team.service";
import { createTeamSchema, updateTeamSchema } from "../../lib/validation/team.schema";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/team] ${context}`, { userId, error });
};

const conflictCode = "23505";

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const { data, error } = await getTeamByOwnerId(supabase, userId);

  if (error) {
    logServiceError("getTeamByOwnerId failed", userId, error);
    return errorResponse(500, "unprocessable_entity", "Failed to load team.");
  }

  if (!data) {
    return errorResponse(404, "not_found", "Team not found.");
  }

  return jsonResponse({ data }, 200);
};

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const parsed = await parseJsonBody(context.request, createTeamSchema, "[api/team]");

  if (!parsed.ok) {
    return parsed.response;
  }

  const created = await createTeamForOwner(supabase, userId, parsed.data.name);

  if (created.error) {
    if (created.error.code === conflictCode) {
      return errorResponse(409, "conflict", "Team already exists.");
    }

    logServiceError("createTeamForOwner failed", userId, created.error);
    return errorResponse(500, "unprocessable_entity", "Failed to create team.");
  }

  return jsonResponse({ data: created.data }, 201);
};

export const PATCH: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const parsed = await parseJsonBody(context.request, updateTeamSchema, "[api/team]");

  if (!parsed.ok) {
    return parsed.response;
  }

  const updated = await updateTeamNameByOwnerId(supabase, userId, parsed.data.name);

  if (updated.error) {
    logServiceError("updateTeamNameByOwnerId failed", userId, updated.error);
    return errorResponse(500, "unprocessable_entity", "Failed to update team.");
  }

  if (!updated.data) {
    return errorResponse(404, "not_found", "Team not found.");
  }

  return jsonResponse({ data: updated.data }, 200);
};
