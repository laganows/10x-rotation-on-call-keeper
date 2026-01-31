import type { APIRoute } from "astro";

import { resolveUserId } from "../../../lib/auth/auth.server";
import { errorResponse } from "../../../lib/http/responses";
import { deleteUnavailability } from "../../../lib/services/unavailabilities.service";
import { unavailabilityIdParamSchema } from "../../../lib/validation/unavailabilities.schema";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/unavailabilities] ${context}`, { userId, error });
};

export const DELETE: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userResult = resolveUserId(context);
  if (!userResult.ok) {
    return userResult.response;
  }
  const userId = userResult.userId;

  const unavailabilityIdParsed = unavailabilityIdParamSchema.safeParse(context.params.unavailabilityId);

  if (!unavailabilityIdParsed.success) {
    return errorResponse(
      400,
      "validation_error",
      "Invalid unavailabilityId path parameter.",
      unavailabilityIdParsed.error.flatten()
    );
  }

  const deleted = await deleteUnavailability(supabase, userId, unavailabilityIdParsed.data);

  if (deleted.error) {
    logServiceError("deleteUnavailability failed", userId, deleted.error);
    const status = deleted.error.code === "not_found" ? 404 : deleted.error.code === "conflict" ? 409 : 500;
    return errorResponse(status, deleted.error.code, deleted.error.message);
  }

  return new Response(null, { status: 204 });
};
