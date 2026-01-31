import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { SupabaseClient as SupabaseClientBase } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars. Provide SUPABASE_URL and SUPABASE_KEY.");
}

if (supabaseAnonKey.split(".").length !== 3) {
  throw new Error("Supabase key must be a JWT. Check SUPABASE_KEY.");
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

export const createSupabaseServerInstance = (context: { headers: Headers; cookies: AstroCookies }) =>
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
  });

export type SupabaseClient = SupabaseClientBase<Database>;

export const DEFAULT_USER_ID = "9609302b-599f-4d15-849c-28a8d197d8a8";
