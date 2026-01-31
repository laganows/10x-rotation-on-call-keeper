import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars. Provide SUPABASE_URL and SUPABASE_KEY.");
}

if (supabaseAnonKey.split(".").length !== 3) {
  throw new Error("Supabase key must be a JWT. Check SUPABASE_KEY.");
}

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
export type SupabaseClient = typeof supabaseClient;

export const DEFAULT_USER_ID = "9609302b-599f-4d15-849c-28a8d197d8a8";
