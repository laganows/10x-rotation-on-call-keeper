import type { SupabaseClient } from "../../db/supabase.client";
import type { DbTeam, TeamDto, UserId } from "../../types";

interface SupabaseError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: SupabaseError };
export type MaybeServiceResult<T> = { data: T | null; error: null } | { data: null; error: SupabaseError };

const mapTeamToDto = (team: DbTeam): TeamDto => ({
  teamId: team.team_id,
  ownerId: team.owner_id,
  name: team.name,
  maxSavedCount: team.max_saved_count,
  createdAt: team.created_at,
  updatedAt: team.updated_at,
});

const createFallbackError = (message: string): SupabaseError => ({
  message,
});

export const getTeamByOwnerId = async (
  supabase: SupabaseClient,
  userId: UserId
): Promise<MaybeServiceResult<TeamDto>> => {
  const { data, error } = await supabase.from("teams").select("*").eq("owner_id", userId).maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return { data: mapTeamToDto(data), error: null };
};

export const createTeamForOwner = async (
  supabase: SupabaseClient,
  userId: UserId,
  name: TeamDto["name"]
): Promise<ServiceResult<TeamDto>> => {
  const { data, error } = await supabase.from("teams").insert({ owner_id: userId, name }).select("*").single();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: createFallbackError("Team creation returned no data.") };
  }

  return { data: mapTeamToDto(data), error: null };
};

export const updateTeamNameByOwnerId = async (
  supabase: SupabaseClient,
  userId: UserId,
  name: TeamDto["name"]
): Promise<MaybeServiceResult<TeamDto>> => {
  const { data, error } = await supabase.from("teams").update({ name }).eq("owner_id", userId).select("*");

  if (error) {
    return { data: null, error };
  }

  const [row] = Array.isArray(data) ? data : [];

  if (!row) {
    return { data: null, error: null };
  }

  return { data: mapTeamToDto(row), error: null };
};
