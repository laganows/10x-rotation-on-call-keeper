import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../../db/supabase.client";
import { errorResponse, jsonResponse, parseJsonBody } from "../../../lib/http/responses";
import { createMember, listMembers } from "../../../lib/services/members.service";
import { createMemberSchema, membersListQuerySchema } from "../../../lib/validation/members.schema";
import type { ApiListResponse, MemberListItemDto } from "../../../types";

export const prerender = false;

const logServiceError = (context: string, userId: string, error: unknown) => {
  // eslint-disable-next-line no-console -- server-side error diagnostics
  console.error(`[api/members] ${context}`, { userId, error });
};

const parseQuery = (request: Request) => {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
};

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  const userId = DEFAULT_USER_ID;

  const parsedQuery = membersListQuerySchema.safeParse(parseQuery(context.request));

  if (!parsedQuery.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters.", parsedQuery.error.flatten());
  }

  const result = await listMembers(supabase, userId, parsedQuery.data);

  if (result.error) {
    logServiceError("listMembers failed", userId, result.error);

    const status = result.error.code === "unprocessable_entity" ? 422 : result.error.code === "not_found" ? 404 : 409;
    return errorResponse(status, result.error.code, result.error.message);
  }

  const body: ApiListResponse<MemberListItemDto> = {
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
  const userId = DEFAULT_USER_ID;

  const parsed = await parseJsonBody(context.request, createMemberSchema, "[api/members]");

  if (!parsed.ok) {
    return parsed.response;
  }

  const created = await createMember(supabase, userId, parsed.data.displayName);

  if (created.error) {
    logServiceError("createMember failed", userId, created.error);

    const status = created.error.code === "unprocessable_entity" ? 422 : created.error.code === "not_found" ? 404 : 409;
    return errorResponse(status, created.error.code, created.error.message);
  }

  return jsonResponse({ data: created.data }, 201);
};

