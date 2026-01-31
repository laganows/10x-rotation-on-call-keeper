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
