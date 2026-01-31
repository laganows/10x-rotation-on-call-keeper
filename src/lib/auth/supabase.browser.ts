import { createBrowserClient, type SetAllCookies } from "@supabase/ssr";

import type { Database } from "@/db/database.types";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

let browserClient: BrowserSupabaseClient | null | undefined;

const isValidJwt = (value: string) => value.split(".").length === 3;

export const getSupabaseBrowserClient = (): BrowserSupabaseClient | null => {
  if (browserClient !== undefined) {
    return browserClient;
  }

  if (typeof document === "undefined") {
    browserClient = null;
    return browserClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    browserClient = null;
    return browserClient;
  }

  if (!isValidJwt(supabaseAnonKey)) {
    // eslint-disable-next-line no-console -- auth misconfiguration diagnostics
    console.error("[auth] Supabase anon key is not a JWT.");
    browserClient = null;
    return browserClient;
  }

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return document.cookie
          .split(";")
          .map((cookie) => cookie.trim())
          .filter(Boolean)
          .map((cookie) => {
            const [name, ...rest] = cookie.split("=");
            return { name, value: decodeURIComponent(rest.join("=")) };
          });
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const segments: string[] = [`${name}=${encodeURIComponent(value)}`];
          if (options?.path) segments.push(`path=${options.path}`);
          if (options?.domain) segments.push(`domain=${options.domain}`);
          if (options?.maxAge !== undefined) segments.push(`max-age=${options.maxAge}`);
          if (options?.expires) {
            const expires = options.expires instanceof Date ? options.expires.toUTCString() : String(options.expires);
            segments.push(`expires=${expires}`);
          }
          if (options?.sameSite) segments.push(`samesite=${options.sameSite}`);
          if (options?.secure) segments.push("secure");
          document.cookie = segments.join("; ");
        });
      },
    },
  });
  return browserClient;
};

export type { BrowserSupabaseClient };
