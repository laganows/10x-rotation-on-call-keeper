/// <reference types="astro/client" />

import type { SupabaseClient } from "./db/supabase.client.ts";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      authRequired?: boolean;
      user?: {
        id: string;
        email: string | null;
      } | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  // Auth behavior:
  // - PUBLIC_AUTH_REQUIRED=true => normal login flow
  // - PUBLIC_AUTH_REQUIRED=false + DEFAULT_USER_ID set => use that user id
  // - PUBLIC_AUTH_REQUIRED=false + DEFAULT_USER_ID missing => 401 (no fallback)
  readonly PUBLIC_AUTH_REQUIRED?: string;
  readonly DEFAULT_USER_ID?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
