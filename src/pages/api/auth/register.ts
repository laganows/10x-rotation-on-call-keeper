import type { APIRoute } from "astro";

import { errorResponse, parseJsonBody } from "../../../lib/http/responses";
import { registerSchema } from "../../../lib/validation/auth.schema";

export const prerender = false;

const existingAccountCodes = new Set(["user_already_exists", "email_exists"]);

const logAuthError = (context: string, error: unknown) => {
  // eslint-disable-next-line no-console -- auth diagnostics
  console.error(`[api/auth/register] ${context}`, { error });
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context.request, registerSchema, "[api/auth/register]");
  if (!parsed.ok) {
    return parsed.response;
  }

  const { email, password } = parsed.data;
  const supabase = context.locals.supabase;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.code && existingAccountCodes.has(error.code)) {
      return errorResponse(409, "conflict", "Konto z tym emailem juz istnieje.");
    }

    if (error.status === 400) {
      return errorResponse(400, "validation_error", "Nieprawidlowe dane rejestracji.");
    }

    logAuthError("signUp failed", error);
    return errorResponse(500, "unprocessable_entity", "Rejestracja nie powiodla sie.");
  }

  return new Response(null, { status: 204 });
};
