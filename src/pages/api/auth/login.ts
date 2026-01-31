import type { APIRoute } from "astro";

import { errorResponse, parseJsonBody } from "../../../lib/http/responses";
import { loginSchema } from "../../../lib/validation/auth.schema";

export const prerender = false;

const invalidLoginCode = "invalid_login_credentials";

const logAuthError = (context: string, error: unknown) => {
  // eslint-disable-next-line no-console -- auth diagnostics
  console.error(`[api/auth/login] ${context}`, { error });
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context.request, loginSchema, "[api/auth/login]");
  if (!parsed.ok) {
    return parsed.response;
  }

  const supabase = context.locals.supabase;
  const { email, password } = parsed.data;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const status = error.code === invalidLoginCode || error.status === 400 ? 401 : 500;

    if (status === 401) {
      return errorResponse(401, "unauthorized", "Nieprawidlowy email lub haslo.");
    }

    logAuthError("signInWithPassword failed", error);
    return errorResponse(500, "unprocessable_entity", "Logowanie nie powiodlo sie.");
  }

  return new Response(null, { status: 204 });
};
