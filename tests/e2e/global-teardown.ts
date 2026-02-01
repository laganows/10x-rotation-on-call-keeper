import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/db/database.types";

const resolveSupabaseUrl = () => process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;

const resolveSupabaseKey = () => process.env.PUBLIC_SUPABASE_ANON_KEY;

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const createSupabaseAdmin = () => {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials for e2e teardown. Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op for teardown
      },
    },
  });
};

export const cleanupSupabase = async () => {
  const supabase = createSupabaseAdmin();

  const assignments = await supabase.from("plan_assignments").delete().neq("plan_id", ZERO_UUID);
  if (assignments.error) {
    throw assignments.error;
  }

  const plans = await supabase.from("plans").delete().neq("plan_id", ZERO_UUID);
  if (plans.error) {
    throw plans.error;
  }

  const events = await supabase.from("events").delete().neq("event_id", ZERO_UUID);
  if (events.error) {
    throw events.error;
  }
};

export default async () => {
  await cleanupSupabase();
};
