import type { APIRoute } from "astro";
import type { ZodType } from "zod";

import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client";
import { createProfile, getProfileByUserId, updateProfile } from "../../lib/services/profile.service";
import { createProfileSchema, updateProfileSchema } from "../../lib/validation/profile.schema";
import type { ApiDataResponse, ApiErrorCode, ApiErrorResponse, ProfileDto } from "../../types";

export const prerender = false;

type JsonResponseBody = ApiDataResponse<ProfileDto> | ApiErrorResponse;

const jsonResponse = (body: JsonResponseBody, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>) =>
  jsonResponse(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status
  );

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/profile] ${context}`, { userId, error });
};

const parseJsonBody = async <T>(request: Request, schema: ZodType<T>) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side error diagnostics
    console.error("[api/profile] invalid JSON body", { error });
    return {
      ok: false as const,
      response: errorResponse(400, "validation_error", "Invalid JSON body."),
    };
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      ok: false as const,
      response: errorResponse(400, "validation_error", "Invalid request body.", result.error.flatten()),
    };
  }

  return { ok: true as const, data: result.data };
};

const conflictCode = "23505";

export const GET: APIRoute = async () => {
  const supabase = supabaseClient;
  const userId = DEFAULT_USER_ID;
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

export const POST: APIRoute = async ({ request }) => {
  const supabase = supabaseClient;
  const userId = DEFAULT_USER_ID;
  const parsed = await parseJsonBody(request, createProfileSchema);

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

export const PATCH: APIRoute = async ({ request }) => {
  const supabase = supabaseClient;
  const userId = DEFAULT_USER_ID;
  const parsed = await parseJsonBody(request, updateProfileSchema);

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
