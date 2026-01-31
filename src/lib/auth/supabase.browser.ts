import { createClient } from "@supabase/supabase-js";

import type { SupabaseClient } from "@/db/supabase.client";
import type { Database } from "@/db/database.types";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null | undefined;

const isValidJwt = (value: string) => value.split(".").length === 3;

export const getSupabaseBrowserClient = (): SupabaseClient | null => {
  if (browserClient !== undefined) {
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

  browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
};

export type BrowserSupabaseClient = SupabaseClient;
