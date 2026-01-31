import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars. Provide PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.");
}

if (supabaseAnonKey.split(".").length !== 3) {
  throw new Error("Supabase key must be a JWT. Check PUBLIC_SUPABASE_ANON_KEY.");
}

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: import.meta.env.PROD,
  httpOnly: false,
  sameSite: "lax",
};

interface CookieToSet {
  name: string;
  value: string;
  options?: Parameters<AstroCookies["set"]>[2];
}

const parseCookieHeader = (cookieHeader: string): { name: string; value: string }[] =>
  cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => {
      const [name, ...rest] = cookie.split("=");
      return { name, value: rest.join("=") };
    });

export const createSupabaseServerInstance = (context: { headers: Headers; cookies: AstroCookies }): SupabaseClient =>
  createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options);
        });
      },
    },
  }) as unknown as SupabaseClient;

export type SupabaseClient = SupabaseJsClient<Database>;

const defaultUserId = import.meta.env.DEFAULT_USER_ID;
export const DEFAULT_USER_ID = defaultUserId?.trim() || null;
