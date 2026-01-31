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
  readonly PUBLIC_AUTH_REQUIRED?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
