import type { APIRoute } from "astro";

import { resolveUserId } from "../../lib/auth/auth.server";
import { errorResponse, jsonResponse, parseJsonBody } from "../../lib/http/responses";
import { createProfile, getProfileByUserId, updateProfile } from "../../lib/services/profile.service";
import { createProfileSchema, updateProfileSchema } from "../../lib/validation/profile.schema";
export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/profile] ${context}`, { userId, error });
};

const conflictCode = "23505";

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;
  const { data, error } = await getProfileByUserId(supabase, userId);

  if (error) {
    logServiceError("getProfileByUserId failed", userId, error);
    return errorResponse(500, "unprocessable_entity", "Failed to load profile.");
  }

  if (!data) {
    return errorResponse(404, "not_found", "Profile not found.");
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
  const parsed = await parseJsonBody(context.request, createProfileSchema, "[api/profile]");

  if (!parsed.ok) {
    return parsed.response;
  }

  const existing = await getProfileByUserId(supabase, userId);

  if (existing.error) {
    logServiceError("getProfileByUserId failed", userId, existing.error);
    return errorResponse(500, "unprocessable_entity", "Failed to load profile.");
  }

  if (existing.data) {
    return jsonResponse({ data: existing.data }, 200);
  }

  const created = await createProfile(supabase, userId, parsed.data.displayName);

  if (created.error) {
    if (created.error.code === conflictCode) {
      const retry = await getProfileByUserId(supabase, userId);

      if (retry.error) {
        logServiceError("getProfileByUserId retry failed", userId, retry.error);
        return errorResponse(500, "unprocessable_entity", "Failed to load profile.");
      }

      if (retry.data) {
        return jsonResponse({ data: retry.data }, 200);
      }

      return errorResponse(409, "conflict", "Profile already exists.");
    }

    logServiceError("createProfile failed", userId, created.error);
    return errorResponse(500, "unprocessable_entity", "Failed to create profile.");
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
  const parsed = await parseJsonBody(context.request, updateProfileSchema, "[api/profile]");

  if (!parsed.ok) {
    return parsed.response;
  }

  const updated = await updateProfile(supabase, userId, parsed.data.displayName);

  if (updated.error) {
    logServiceError("updateProfile failed", userId, updated.error);
    return errorResponse(500, "unprocessable_entity", "Failed to update profile.");
  }

  if (!updated.data) {
    return errorResponse(404, "not_found", "Profile not found.");
  }

  return jsonResponse({ data: updated.data }, 200);
};
