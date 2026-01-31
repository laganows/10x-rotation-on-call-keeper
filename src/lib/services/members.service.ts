import type { SupabaseClient } from "../../db/supabase.client";
import type { DbMember, MemberDto, MemberId, MemberListItemDto, MembersListQuery, TeamId, UserId } from "../../types";

interface SupabaseError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: SupabaseError };
export type MaybeServiceResult<T> = { data: T | null; error: null } | { data: null; error: SupabaseError };

export type ListServiceResult<T> =
  | { data: { items: T[]; total: number }; error: null }
  | { data: null; error: SupabaseError };

export type DomainErrorCode = "not_found" | "conflict" | "unprocessable_entity";
export interface DomainError {
  code: DomainErrorCode;
  message: string;
}

export type DomainServiceResult<T> = { data: T; error: null } | { data: null; error: DomainError };

const mapMemberToDto = (row: DbMember): MemberDto => ({
  memberId: row.member_id,
  teamId: row.team_id,
  displayName: row.display_name,
  initialOnCallCount: row.initial_on_call_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const getTeamForOwner = async (
  supabase: SupabaseClient,
  userId: UserId
): Promise<MaybeServiceResult<{ teamId: TeamId; maxSavedCount: number }>> => {
  const { data, error } = await supabase
    .from("teams")
    .select("team_id, max_saved_count")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return {
    data: { teamId: data.team_id, maxSavedCount: data.max_saved_count },
    error: null,
  };
};

export const listMembers = async (
  supabase: SupabaseClient,
  userId: UserId,
  query: MembersListQuery
): Promise<DomainServiceResult<{ items: MemberListItemDto[]; total: number }>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (team.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load team." } };
  }

  if (!team.data) {
    return { data: null, error: { code: "unprocessable_entity", message: "Team not found for user." } };
  }

  const sortColumn = query.sort === "displayName" ? "display_name" : "created_at";
  const orderAscending = query.order === "asc";
  const status = query.status ?? "active";
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  // range() uses inclusive indices
  const from = offset;
  const to = offset + limit - 1;

  let membersQuery = supabase.from("members").select("*", { count: "exact" }).eq("team_id", team.data.teamId);

  if (status === "active") {
    membersQuery = membersQuery.is("deleted_at", null);
  }

  const {
    data: rows,
    error,
    count,
  } = await membersQuery.order(sortColumn, { ascending: orderAscending }).range(from, to);

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to list members." } };
  }

  const members = Array.isArray(rows) ? rows : [];
  const total = typeof count === "number" ? count : 0;

  const memberIds = members.map((m) => m.member_id).filter(Boolean);

  const savedCountByMemberId = new Map<string, number>();

  if (memberIds.length > 0) {
    const assignments = await supabase
      .from("plan_assignments")
      .select("member_id")
      .eq("team_id", team.data.teamId)
      .not("member_id", "is", null)
      .in("member_id", memberIds);

    if (assignments.error) {
      return { data: null, error: { code: "unprocessable_entity", message: "Failed to compute savedCount." } };
    }

    for (const a of assignments.data ?? []) {
      if (!a.member_id) continue;
      savedCountByMemberId.set(a.member_id, (savedCountByMemberId.get(a.member_id) ?? 0) + 1);
    }
  }

  const items: MemberListItemDto[] = members.map((m) => ({
    ...mapMemberToDto(m),
    savedCount: savedCountByMemberId.get(m.member_id) ?? 0,
  }));

  return { data: { items, total }, error: null };
};

export const createMember = async (
  supabase: SupabaseClient,
  userId: UserId,
  displayName: MemberDto["displayName"]
): Promise<DomainServiceResult<MemberDto>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (team.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load team." } };
  }

  if (!team.data) {
    return { data: null, error: { code: "unprocessable_entity", message: "Team not found for user." } };
  }

  const { data, error } = await supabase
    .from("members")
    .insert({
      team_id: team.data.teamId,
      display_name: displayName,
      initial_on_call_count: team.data.maxSavedCount,
    })
    .select("*")
    .single();

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to create member." } };
  }

  if (!data) {
    return { data: null, error: { code: "unprocessable_entity", message: "Member creation returned no data." } };
  }

  return { data: mapMemberToDto(data), error: null };
};

export const updateMember = async (
  supabase: SupabaseClient,
  userId: UserId,
  memberId: MemberId,
  displayName: MemberDto["displayName"]
): Promise<DomainServiceResult<MemberDto>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (team.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load team." } };
  }

  if (!team.data) {
    return { data: null, error: { code: "unprocessable_entity", message: "Team not found for user." } };
  }

  const { data, error } = await supabase
    .from("members")
    .update({ display_name: displayName })
    .eq("team_id", team.data.teamId)
    .eq("member_id", memberId)
    .is("deleted_at", null)
    .select("*");

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to update member." } };
  }

  const [row] = Array.isArray(data) ? data : [];

  if (!row) {
    return { data: null, error: { code: "not_found", message: "Member not found." } };
  }

  return { data: mapMemberToDto(row), error: null };
};

export const softDeleteMember = async (
  supabase: SupabaseClient,
  userId: UserId,
  memberId: MemberId
): Promise<DomainServiceResult<null>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (team.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load team." } };
  }

  if (!team.data) {
    return { data: null, error: { code: "unprocessable_entity", message: "Team not found for user." } };
  }

  const existing = await supabase
    .from("members")
    .select("deleted_at")
    .eq("team_id", team.data.teamId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load member." } };
  }

  if (!existing.data) {
    return { data: null, error: { code: "not_found", message: "Member not found." } };
  }

  if (existing.data.deleted_at) {
    return { data: null, error: { code: "conflict", message: "Member already deleted." } };
  }

  const deletedAt = new Date().toISOString();
  const updated = await supabase
    .from("members")
    .update({ deleted_at: deletedAt })
    .eq("team_id", team.data.teamId)
    .eq("member_id", memberId)
    .is("deleted_at", null)
    .select("member_id");

  if (updated.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to delete member." } };
  }

  return { data: null, error: null };
};

// exported for potential reuse/testing
export const __internal = {
  mapMemberToDto,
};
