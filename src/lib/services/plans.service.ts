import type { SupabaseClient } from "../../db/supabase.client";
import type {
  DbMember,
  DbPlan,
  DbPlanAssignment,
  DbTeam,
  PlanAssignmentDto,
  PlanDto,
  PlanId,
  PlanPreviewAssignmentDto,
  PlanPreviewCounterDto,
  PlanPreviewDto,
  PlanPreviewInequalityDto,
  PlanSavedSummaryDto,
  PlansListQuery,
  SavePlanCommand,
  TeamId,
  UnavailabilityDto,
  UserId,
  YyyyMmDd,
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

const mapPlanToDto = (row: DbPlan): PlanDto => ({
  planId: row.plan_id,
  teamId: row.team_id,
  createdBy: row.created_by,
  createdAt: row.created_at,
  startDate: row.start_date,
  endDate: row.end_date,
});

const mapPlanAssignmentToDto = (row: DbPlanAssignment): PlanAssignmentDto => ({
  planId: row.plan_id,
  teamId: row.team_id,
  day: row.day,
  memberId: row.member_id,
  createdAt: row.created_at,
});

const mapMemberToPreviewCounter = (
  member: DbMember,
  savedCount: number,
  previewCount: number
): PlanPreviewCounterDto => ({
  memberId: member.member_id,
  displayName: member.display_name,
  savedCount,
  previewCount,
  effectiveCount: member.initial_on_call_count + savedCount + previewCount,
});

const getTeamForOwner = async (supabase: SupabaseClient, userId: UserId): Promise<{ teamId: TeamId } | null> => {
  const { data, error } = await supabase
    .from("teams")
    .select("team_id")
    .eq("owner_id", userId)
    .maybeSingle<Pick<DbTeam, "team_id">>();

  if (error || !data) {
    return null;
  }

  return { teamId: data.team_id };
};

export const listPlans = async (
  supabase: SupabaseClient,
  userId: UserId,
  query: PlansListQuery
): Promise<DomainServiceResult<{ items: PlanDto[]; total: number }>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const sortColumn = query.sort === "startDate" ? "start_date" : "created_at";
  const orderAscending = query.order === "asc";
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const from = offset;
  const to = offset + limit - 1;

  let listQuery = supabase.from("plans").select("*", { count: "exact" }).eq("team_id", team.teamId);

  if (query.startDate) {
    listQuery = listQuery.gte("end_date", query.startDate);
  }

  if (query.endDate) {
    listQuery = listQuery.lte("start_date", query.endDate);
  }

  const { data: rows, error, count } = await listQuery.order(sortColumn, { ascending: orderAscending }).range(from, to);

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to list plans." } };
  }

  const items = (rows ?? []).map(mapPlanToDto);
  const total = typeof count === "number" ? count : 0;

  return { data: { items, total }, error: null };
};

export const getPlan = async (
  supabase: SupabaseClient,
  userId: UserId,
  planId: PlanId
): Promise<DomainServiceResult<PlanDto>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("team_id", team.teamId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load plan." } };
  }

  if (!data) {
    return { data: null, error: { code: "not_found", message: "Plan not found." } };
  }

  return { data: mapPlanToDto(data), error: null };
};

export const listPlanAssignments = async (
  supabase: SupabaseClient,
  userId: UserId,
  planId: PlanId,
  query: { limit?: number; offset?: number; order?: "asc" | "desc" }
): Promise<DomainServiceResult<{ items: PlanAssignmentDto[]; total: number }>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const plan = await supabase
    .from("plans")
    .select("plan_id")
    .eq("team_id", team.teamId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (plan.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load plan." } };
  }

  if (!plan.data) {
    return { data: null, error: { code: "not_found", message: "Plan not found." } };
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const from = offset;
  const to = offset + limit - 1;
  const orderAscending = query.order === "asc";

  const { data, error, count } = await supabase
    .from("plan_assignments")
    .select("*", { count: "exact" })
    .eq("team_id", team.teamId)
    .eq("plan_id", planId)
    .order("day", { ascending: orderAscending })
    .range(from, to);

  if (error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to list plan assignments." } };
  }

  const items = (data ?? []).map(mapPlanAssignmentToDto);
  const total = typeof count === "number" ? count : 0;

  return { data: { items, total }, error: null };
};

const listActiveMembers = async (
  supabase: SupabaseClient,
  teamId: TeamId
): Promise<{ members: DbMember[]; error: SupabaseError | null }> => {
  const { data, error } = await supabase.from("members").select("*").eq("team_id", teamId).is("deleted_at", null);

  if (error) {
    return { members: [], error };
  }

  return { members: data ?? [], error: null };
};

const listUnavailabilitiesInRange = async (
  supabase: SupabaseClient,
  teamId: TeamId,
  startDate: YyyyMmDd,
  endDate: YyyyMmDd
): Promise<{ items: UnavailabilityDto[]; error: SupabaseError | null }> => {
  const { data, error } = await supabase
    .from("unavailabilities")
    .select("*")
    .eq("team_id", teamId)
    .gte("day", startDate)
    .lte("day", endDate);

  if (error) {
    return { items: [], error };
  }

  const items: UnavailabilityDto[] =
    data?.map((row) => ({
      unavailabilityId: row.unavailability_id,
      teamId: row.team_id,
      memberId: row.member_id,
      day: row.day,
      createdAt: row.created_at,
    })) ?? [];

  return { items, error: null };
};

const getSavedCountsByMember = async (
  supabase: SupabaseClient,
  teamId: TeamId
): Promise<{ counts: Map<string, number>; error: SupabaseError | null }> => {
  const { data, error } = await supabase
    .from("plan_assignments")
    .select("member_id")
    .eq("team_id", teamId)
    .not("member_id", "is", null)
    .overrideTypes<Pick<DbPlanAssignment, "member_id">[], { merge: false }>();

  if (error) {
    return { counts: new Map(), error };
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    if (!row.member_id) continue;
    counts.set(row.member_id, (counts.get(row.member_id) ?? 0) + 1);
  }

  return { counts, error: null };
};

const dateRangeDays = (start: YyyyMmDd, end: YyyyMmDd) => {
  const toUtc = (value: string) => new Date(`${value}T00:00:00.000Z`).getTime();
  const diffDays = Math.floor((toUtc(end) - toUtc(start)) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const enumerateDays = (start: YyyyMmDd, end: YyyyMmDd): YyyyMmDd[] => {
  const days: YyyyMmDd[] = [];
  const startTime = new Date(`${start}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${end}T00:00:00.000Z`).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let t = startTime; t <= endTime; t += dayMs) {
    days.push(new Date(t).toISOString().slice(0, 10) as YyyyMmDd);
  }

  return days;
};

const computeInequality = (counters: PlanPreviewCounterDto[]): PlanPreviewInequalityDto => {
  if (counters.length === 0) {
    return { historical: 0, preview: 0 };
  }

  const effectiveCounts = counters.map((c) => c.effectiveCount);
  const historicalCounts = counters.map((c) => c.savedCount);

  const maxEffective = Math.max(...effectiveCounts);
  const minEffective = Math.min(...effectiveCounts);
  const maxHistorical = Math.max(...historicalCounts);
  const minHistorical = Math.min(...historicalCounts);

  return {
    historical: maxHistorical - minHistorical,
    preview: maxEffective - minEffective,
  };
};

export const generatePlanPreview = async (
  supabase: SupabaseClient,
  userId: UserId,
  startDate: YyyyMmDd,
  endDate: YyyyMmDd
): Promise<DomainServiceResult<PlanPreviewDto>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const [membersResult, unavailabilityResult, savedCountsResult] = await Promise.all([
    listActiveMembers(supabase, team.teamId),
    listUnavailabilitiesInRange(supabase, team.teamId, startDate, endDate),
    getSavedCountsByMember(supabase, team.teamId),
  ]);

  if (membersResult.error || unavailabilityResult.error || savedCountsResult.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load preview data." } };
  }

  const members = membersResult.members;
  const savedCounts = savedCountsResult.counts;
  const previewCounts = new Map<string, number>();
  const unavailabilityByDay = new Map<string, Set<string>>();

  for (const unavailability of unavailabilityResult.items) {
    if (!unavailabilityByDay.has(unavailability.day)) {
      unavailabilityByDay.set(unavailability.day, new Set());
    }
    unavailabilityByDay.get(unavailability.day)?.add(unavailability.memberId);
  }

  const assignments: PlanPreviewAssignmentDto[] = [];
  const unassignedDays: YyyyMmDd[] = [];
  const days = enumerateDays(startDate, endDate);

  for (const day of days) {
    const unavailable = unavailabilityByDay.get(day) ?? new Set<string>();
    const eligible = members.filter((member) => !unavailable.has(member.member_id));

    if (eligible.length === 0) {
      assignments.push({ day, memberId: null });
      unassignedDays.push(day);
      continue;
    }

    eligible.sort((a, b) => {
      const aSaved = savedCounts.get(a.member_id) ?? 0;
      const bSaved = savedCounts.get(b.member_id) ?? 0;
      const aPreview = previewCounts.get(a.member_id) ?? 0;
      const bPreview = previewCounts.get(b.member_id) ?? 0;
      const aEffective = a.initial_on_call_count + aSaved + aPreview;
      const bEffective = b.initial_on_call_count + bSaved + bPreview;

      if (aEffective !== bEffective) {
        return aEffective - bEffective;
      }

      return a.member_id.localeCompare(b.member_id);
    });

    const chosen = eligible[0];
    previewCounts.set(chosen.member_id, (previewCounts.get(chosen.member_id) ?? 0) + 1);
    assignments.push({ day, memberId: chosen.member_id });
  }

  const counters: PlanPreviewCounterDto[] = members.map((member) =>
    mapMemberToPreviewCounter(member, savedCounts.get(member.member_id) ?? 0, previewCounts.get(member.member_id) ?? 0)
  );

  const inequality = computeInequality(counters);
  const rangeDays = dateRangeDays(startDate, endDate);

  const preview: PlanPreviewDto = {
    startDate,
    endDate,
    rangeDays,
    assignments,
    counters,
    inequality,
    unassignedDays,
  };

  await supabase.from("events").insert({
    team_id: team.teamId,
    actor_user_id: userId,
    event_type: "plan_generated",
    start_date: startDate,
    end_date: endDate,
    range_days: rangeDays,
    members_count: members.length,
    unassigned_count: unassignedDays.length,
    inequality: inequality.preview,
    duration_ms: null,
    metadata: {},
  });

  return { data: preview, error: null };
};

const updateTeamMaxSavedCount = async (supabase: SupabaseClient, teamId: TeamId): Promise<SupabaseError | null> => {
  const { counts, error } = await getSavedCountsByMember(supabase, teamId);

  if (error) {
    return error;
  }

  let maxCount = 0;

  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }

  const update = await supabase.from("teams").update({ max_saved_count: maxCount }).eq("team_id", teamId);

  if (update.error) {
    return update.error;
  }

  return null;
};

export const savePlan = async (
  supabase: SupabaseClient,
  userId: UserId,
  command: SavePlanCommand
): Promise<DomainServiceResult<PlanSavedSummaryDto>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const { data: planRow, error: planError } = await supabase
    .from("plans")
    .insert({
      team_id: team.teamId,
      created_by: userId,
      start_date: command.startDate,
      end_date: command.endDate,
    })
    .select("*")
    .single();

  if (planError) {
    const code: DomainErrorCode = planError.code === "23P01" ? "conflict" : "unprocessable_entity";
    return { data: null, error: { code, message: "Failed to create plan." } };
  }

  if (!planRow) {
    return { data: null, error: { code: "unprocessable_entity", message: "Plan creation returned no data." } };
  }

  const assignmentsPayload = command.assignments.map((assignment) => ({
    team_id: team.teamId,
    plan_id: planRow.plan_id,
    day: assignment.day,
    member_id: assignment.memberId,
  }));

  const assignmentsInsert = await supabase.from("plan_assignments").insert(assignmentsPayload);

  if (assignmentsInsert.error) {
    const code: DomainErrorCode = assignmentsInsert.error.code === "23P01" ? "conflict" : "unprocessable_entity";
    return { data: null, error: { code, message: "Failed to create plan assignments." } };
  }

  const updateError = await updateTeamMaxSavedCount(supabase, team.teamId);

  if (updateError) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to update team counters." } };
  }

  const unassignedCount = command.assignments.filter((assignment) => assignment.memberId === null).length;

  await supabase.from("events").insert({
    team_id: team.teamId,
    actor_user_id: userId,
    event_type: "plan_saved",
    start_date: command.startDate,
    end_date: command.endDate,
    range_days: dateRangeDays(command.startDate, command.endDate),
    members_count: null,
    unassigned_count: unassignedCount,
    inequality: null,
    duration_ms: command.durationMs,
    metadata: {},
  });

  return {
    data: {
      plan: {
        planId: planRow.plan_id,
        startDate: planRow.start_date,
        endDate: planRow.end_date,
      },
      assignmentsCount: command.assignments.length,
      unassignedCount,
    },
    error: null,
  };
};
