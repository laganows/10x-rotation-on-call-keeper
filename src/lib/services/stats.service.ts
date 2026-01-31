import type { SupabaseClient } from "../../db/supabase.client";
import type {
  DbMember,
  DbPlanAssignment,
  PlanId,
  StatsByMemberDto,
  StatsDaysDto,
  StatsDtoGlobal,
  StatsDtoPlan,
  StatsMembersDto,
  TeamId,
  UserId,
} from "../../types";

interface SupabaseError {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export type DomainErrorCode = "not_found" | "unprocessable_entity";
export interface DomainError {
  code: DomainErrorCode;
  message: string;
}

export type DomainServiceResult<T> = { data: T; error: null } | { data: null; error: DomainError };

type StatsMemberPreview = Pick<DbMember, "member_id" | "display_name">;
type StatsAssignmentPreview = Pick<DbPlanAssignment, "day" | "member_id">;
type OverrideTypes = () => unknown;

const withOverrideTypes = (query: { overrideTypes?: OverrideTypes }) =>
  typeof query.overrideTypes === "function" ? query.overrideTypes() : query;

const getTeamForOwner = async (supabase: SupabaseClient, userId: UserId): Promise<{ teamId: TeamId } | null> => {
  const { data, error } = await supabase.from("teams").select("team_id").eq("owner_id", userId).maybeSingle();

  if (error || !data) {
    return null;
  }

  return { teamId: data.team_id };
};

const listActiveMembers = async (
  supabase: SupabaseClient,
  teamId: TeamId
): Promise<{ members: StatsMemberPreview[]; error: SupabaseError | null }> => {
  const response = await withOverrideTypes(
    supabase.from("members").select("member_id, display_name").eq("team_id", teamId).is("deleted_at", null)
  );
  const { data, error } = response as { data: StatsMemberPreview[] | null; error: SupabaseError | null };

  if (error) {
    return { members: [], error };
  }

  return { members: data ?? [], error: null };
};

const listPlanAssignments = async (
  supabase: SupabaseClient,
  teamId: TeamId,
  planId?: PlanId
): Promise<{ assignments: StatsAssignmentPreview[]; error: SupabaseError | null }> => {
  let query = supabase.from("plan_assignments").select("day, member_id").eq("team_id", teamId);

  if (planId) {
    query = query.eq("plan_id", planId);
  }

  const response = await withOverrideTypes(query);
  const { data, error } = response as { data: StatsAssignmentPreview[] | null; error: SupabaseError | null };

  if (error) {
    return { assignments: [], error };
  }

  return { assignments: data ?? [], error: null };
};

const classifyDay = (day: string) => {
  const date = new Date(`${day}T00:00:00.000Z`);
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6 ? "weekend" : "weekday";
};

const buildStatsDays = (assignments: StatsAssignmentPreview[]): StatsDaysDto => {
  let weekends = 0;
  let weekdays = 0;
  let unassigned = 0;

  for (const assignment of assignments) {
    if (assignment.member_id === null) {
      unassigned += 1;
    }

    if (classifyDay(assignment.day) === "weekend") {
      weekends += 1;
    } else {
      weekdays += 1;
    }
  }

  return {
    total: assignments.length,
    weekdays,
    weekends,
    unassigned,
  };
};

const buildByMember = (members: StatsMemberPreview[], assignments: StatsAssignmentPreview[]): StatsByMemberDto[] => {
  const counts = new Map<string, number>();

  for (const assignment of assignments) {
    if (!assignment.member_id) continue;
    counts.set(assignment.member_id, (counts.get(assignment.member_id) ?? 0) + 1);
  }

  return members.map((member) => ({
    memberId: member.member_id,
    displayName: member.display_name,
    assignedDays: counts.get(member.member_id) ?? 0,
  }));
};

const buildMembersSummary = (byMember: StatsByMemberDto[]): StatsMembersDto => {
  if (byMember.length === 0) {
    return { min: 0, max: 0, inequality: 0 };
  }

  const values = byMember.map((row) => row.assignedDays);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { min, max, inequality: max - min };
};

export const getGlobalStats = async (
  supabase: SupabaseClient,
  userId: UserId
): Promise<DomainServiceResult<StatsDtoGlobal>> => {
  const team = await getTeamForOwner(supabase, userId);

  if (!team) {
    return { data: null, error: { code: "not_found", message: "Team not found for user." } };
  }

  const [membersResult, assignmentsResult] = await Promise.all([
    listActiveMembers(supabase, team.teamId),
    listPlanAssignments(supabase, team.teamId),
  ]);

  if (membersResult.error || assignmentsResult.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load stats." } };
  }

  const byMember = buildByMember(membersResult.members, assignmentsResult.assignments);
  const days = buildStatsDays(assignmentsResult.assignments);
  const members = buildMembersSummary(byMember);

  return {
    data: {
      scope: "global",
      days,
      members,
      byMember,
    },
    error: null,
  };
};

export const getPlanStats = async (
  supabase: SupabaseClient,
  userId: UserId,
  planId: PlanId
): Promise<DomainServiceResult<StatsDtoPlan>> => {
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

  const [membersResult, assignmentsResult] = await Promise.all([
    listActiveMembers(supabase, team.teamId),
    listPlanAssignments(supabase, team.teamId, planId),
  ]);

  if (membersResult.error || assignmentsResult.error) {
    return { data: null, error: { code: "unprocessable_entity", message: "Failed to load stats." } };
  }

  const byMember = buildByMember(membersResult.members, assignmentsResult.assignments);
  const days = buildStatsDays(assignmentsResult.assignments);
  const members = buildMembersSummary(byMember);

  return {
    data: {
      scope: "plan",
      planId,
      days,
      members,
      byMember,
    },
    error: null,
  };
};
