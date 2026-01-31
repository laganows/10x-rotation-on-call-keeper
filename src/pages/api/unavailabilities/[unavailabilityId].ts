import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../db/supabase.client";
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
  const userId = DEFAULT_USER_ID;

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
