import type { SupabaseClient } from "../../db/supabase.client";
import type {
  DbUnavailability,
  MemberId,
  TeamId,
  UnavailabilitiesListQuery,
  UnavailabilityDto,
  UnavailabilityId,
  UnavailabilityOnConflict,
  UserId,
} from "../../types";

interface SupabaseError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export type DomainErrorCode = "not_found" | "conflict" | "unprocessable_entity";
export interface DomainError {
  code: DomainErrorCode;
  message: string;
}

export type DomainServiceResult<T> = { data: T; error: null } | { data: null; error: DomainError };

const mapUnavailabilityToDto = (row: DbUnavailability): UnavailabilityDto => ({
  unavailabilityId: row.unavailability_id,
  teamId: row.team_id,
  memberId: row.member_id,
  day: row.day,
  createdAt: row.created_at,
});

const getTeamForOwner = async (
  supabase: SupabaseClient,
  userId: UserId
): Promise<{ teamId: TeamId } | null> => {
  const { data, error } = await supabase.from("teams").select("team_id").eq("owner_id", userId).maybeSingle();

  if (error || !data) {
    return null;
  }

  return { teamId: data.team_id };
};

const ensureActiveMember = async (
  supabase: SupabaseClient,
  teamId: TeamId,
  memberId: MemberId
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("members")
    .select("member_id")
    .eq("team_id", teamId)
    .eq("member_id", memberId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
};

export const listUnavailabilities = async (
  supabase: SupabaseClient,
  userId: UserId,
  query: UnavailabilitiesListQuery
): Promise<DomainServiceResult<{ items: UnavailabilityDto[]; total: number }>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const sortColumn = "day";
  const orderAscending = query.order === "asc";
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const from = offset;
  const to = offset + limit - 1;

  let listQuery = supabase
    .from("unavailabilities")
    .select("*", { count: "exact" })
    .eq("team_id", team.teamId)
    .gte("day", query.startDate)
    .lte("day", query.endDate);

  if (query.memberId) {
    listQuery = listQuery.eq("member_id", query.memberId);
  }

  const { data: rows, error, count } = await listQuery.order(sortColumn, { ascending: orderAscending }).range(from, to);

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to list unavailabilities." } };
  }

  const items = (rows ?? []).map(mapUnavailabilityToDto);
  const total = typeof count === "number" ? count : 0;

  return { data: { items, total }, error: null };
};

export const createUnavailability = async (
  supabase: SupabaseClient,
  userId: UserId,
  memberId: MemberId,
  day: UnavailabilityDto["day"],
  onConflict: UnavailabilityOnConflict
): Promise<DomainServiceResult<{ item: UnavailabilityDto; wasExisting: boolean }>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const isActive = await ensureActiveMember(supabase, team.teamId, memberId);

  if (!isActive) {
    return { data: null, error: { code: "not_found", message: "Member not found." } };
  }

  const { data, error } = await supabase
    .from("unavailabilities")
    .insert({ team_id: team.teamId, member_id: memberId, day })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && onConflict === "ignore") {
      const existing = await supabase
        .from("unavailabilities")
        .select("*")
        .eq("team_id", team.teamId)
        .eq("member_id", memberId)
        .eq("day", day)
        .maybeSingle();

      if (existing.error || !existing.data) {
        return { data: null, error: { code: "conflict", message: "Unavailability already exists." } };
      }

      return {
        data: { item: mapUnavailabilityToDto(existing.data), wasExisting: true },
        error: null,
      };
    }

    if (error.code === "23505") {
      return { data: null, error: { code: "conflict", message: "Unavailability already exists." } };
    }

    return { data: null, error: { code: "unprocessable_entity", message: "Failed to create unavailability." } };
  }

  if (!data) {
    return { data: null, error: { code: "unprocessable_entity", message: "Unavailability creation returned no data." } };
  }

  return { data: { item: mapUnavailabilityToDto(data), wasExisting: false }, error: null };
};

export const deleteUnavailability = async (
  supabase: SupabaseClient,
  userId: UserId,
  unavailabilityId: UnavailabilityId
): Promise<DomainServiceResult<null>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const { data, error } = await supabase
    .from("unavailabilities")
    .delete()
    .eq("team_id", team.teamId)
    .eq("unavailability_id", unavailabilityId)
    .select("unavailability_id");

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to delete unavailability." } };
  }

  const [row] = Array.isArray(data) ? data : [];

  if (!row) {
    return { data: null, error: { code: "not_found", message: "Unavailability not found." } };
  }

  return { data: null, error: null };
};

