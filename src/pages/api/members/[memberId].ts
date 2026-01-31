import type { APIRoute } from "astro";

import { resolveUserId } from "../../../lib/auth/auth.server";
import { errorResponse, jsonResponse, parseJsonBody } from "../../../lib/http/responses";
import { softDeleteMember, updateMember } from "../../../lib/services/members.service";
import { memberIdParamSchema, updateMemberSchema } from "../../../lib/validation/members.schema";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/members] ${context}`, { userId, error });
};

export const PATCH: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const memberIdParsed = memberIdParamSchema.safeParse(context.params.memberId);

  if (!memberIdParsed.success) {
    return errorResponse(400, "validation_error", "Invalid memberId path parameter.", memberIdParsed.error.flatten());
  }

  const parsedBody = await parseJsonBody(context.request, updateMemberSchema, "[api/members/:memberId]");

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const updated = await updateMember(supabase, userId, memberIdParsed.data, parsedBody.data.displayName);

  if (updated.error) {
    logServiceError("updateMember failed", userId, updated.error);

    const status = updated.error.code === "unprocessable_entity" ? 500 : updated.error.code === "not_found" ? 404 : 409;
    return errorResponse(status, updated.error.code, updated.error.message);
  }

  return jsonResponse({ data: updated.data }, 200);
};

export const DELETE: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const memberIdParsed = memberIdParamSchema.safeParse(context.params.memberId);

  if (!memberIdParsed.success) {
    return errorResponse(400, "validation_error", "Invalid memberId path parameter.", memberIdParsed.error.flatten());
  }

  const deleted = await softDeleteMember(supabase, userId, memberIdParsed.data);

  if (deleted.error) {
    logServiceError("softDeleteMember failed", userId, deleted.error);

    const status = deleted.error.code === "unprocessable_entity" ? 500 : deleted.error.code === "not_found" ? 404 : 409;
    return errorResponse(status, deleted.error.code, deleted.error.message);
  }

  return new Response(null, { status: 204 });
};
