import { defineMiddleware } from "astro:middleware";

import { errorResponse } from "../lib/http/responses";

const publicPaths = new Set(["/login", "/register", "/api/auth/login", "/api/auth/register"]);

const parseAuthRequired = () => {
  const raw = import.meta.env.PUBLIC_AUTH_REQUIRED;
  if (!raw) return false;
  return raw === "true" || raw === "1";
};

const isApiRoute = (pathname: string) => pathname.startsWith("/api/");

export const onRequest = defineMiddleware(async (context, next) => {
  const { createSupabaseServerInstance } = await import("../db/supabase.client.ts");

  const authRequired = parseAuthRequired();
  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  });

  context.locals.supabase = supabase;
  context.locals.authRequired = authRequired;

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    // eslint-disable-next-line no-console -- auth diagnostics
    console.error("[auth] Failed to resolve user session.", error);
  }

  const user = data?.user ?? null;
  context.locals.user = user
    ? {
        id: user.id,
        email: user.email ?? null,
      }
    : null;

  const pathname = context.url.pathname;

  if (!authRequired) {
    return next();
  }

  if (publicPaths.has(pathname)) {
    return next();
  }

  if (!user) {
    if (isApiRoute(pathname)) {
      return errorResponse(401, "unauthorized", "Login required.");
    }
    return context.redirect("/login");
  }

  return next();
});
