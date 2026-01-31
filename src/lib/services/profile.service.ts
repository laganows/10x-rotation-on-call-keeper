import type { SupabaseClient } from "../../db/supabase.client";
import type { DbProfile, ProfileDto, UserId } from "../../types";

interface SupabaseError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: SupabaseError };

export type MaybeServiceResult<T> = { data: T | null; error: null } | { data: null; error: SupabaseError };

const mapProfileToDto = (profile: DbProfile): ProfileDto => ({
  userId: profile.user_id,
  displayName: profile.display_name,
  createdAt: profile.created_at,
  updatedAt: profile.updated_at,
});

const createFallbackError = (message: string): SupabaseError => ({
  message,
});

export const getProfileByUserId = async (
  supabase: SupabaseClient,
  userId: UserId
): Promise<MaybeServiceResult<ProfileDto>> => {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return { data: mapProfileToDto(data), error: null };
};

export const createProfile = async (
  supabase: SupabaseClient,
  userId: UserId,
  displayName: ProfileDto["displayName"]
): Promise<ServiceResult<ProfileDto>> => {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/96b4cd27-b32b-41c7-97c5-f173446ec86a", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "rls-pre-fix",
      hypothesisId: "H1",
      location: "src/lib/services/profile.service.ts:49",
      message: "createProfile insert start",
      data: {
        hasUserId: Boolean(userId),
        displayNameType: displayName === null ? "null" : typeof displayName,
        displayNameLength: typeof displayName === "string" ? displayName.length : null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => null);
  // #endregion agent log
  const { data, error } = await supabase
    .from("profiles")
    .insert({ user_id: userId, display_name: displayName })
    .select("*")
    .single();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return {
      data: null,
      error: createFallbackError("Profile creation returned no data."),
    };
  }

  return { data: mapProfileToDto(data), error: null };
};

export const updateProfile = async (
  supabase: SupabaseClient,
  userId: UserId,
  displayName: ProfileDto["displayName"]
): Promise<MaybeServiceResult<ProfileDto>> => {
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("user_id", userId)
    .select("*");

  if (error) {
    return { data: null, error };
  }

  const [row] = Array.isArray(data) ? data : [];

  if (!row) {
    return { data: null, error: null };
  }

  return { data: mapProfileToDto(row), error: null };
};
