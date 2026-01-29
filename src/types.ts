/**
 * Shared backend+frontend types: DTOs (responses) + Command Models (requests).
 *
 * All DTO field types are derived from Supabase-generated DB entity types to keep
 * a strong link between API shapes and the underlying schema.
 */

import type { Json, Tables } from "./db/database.types";

/** ---- DB entity aliases (single source of truth) ---- */
export type DbProfile = Tables<"profiles">;
export type DbTeam = Tables<"teams">;
export type DbMember = Tables<"members">;
export type DbUnavailability = Tables<"unavailabilities">;
export type DbPlan = Tables<"plans">;
export type DbPlanAssignment = Tables<"plan_assignments">;
export type DbEvent = Tables<"events">;

/** ---- Common primitives (API conventions) ---- */
export type IsoTimestamp = string; // ISO 8601 UTC timestamp string
export type YyyyMmDd = string; // YYYY-MM-DD UTC date string

export type PaginationOrder = "asc" | "desc";
export interface PaginationParams {
  limit?: number; // default 50, max 200 (validated server-side)
  offset?: number; // default 0 (validated server-side)
}

/** Standard API envelope(s) */
export interface ApiDataResponse<T> {
  data: T;
}
export interface ApiListResponse<T> {
  data: T[];
  page: PageDto;
}

export interface PageDto {
  limit: number;
  offset: number;
  total: number;
}

/** Standard API error shape */
export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "unprocessable_entity"
  | (string & {}); // allow future server codes without breaking clients

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** ---- ID aliases derived from DB column types ---- */
export type UserId = DbProfile["user_id"];
export type TeamId = DbTeam["team_id"];
export type MemberId = DbMember["member_id"];
export type PlanId = DbPlan["plan_id"];
export type UnavailabilityId = DbUnavailability["unavailability_id"];
export type EventId = DbEvent["event_id"];

/** ---- DTOs ---- */

/** Profile: GET/POST/PATCH `/api/profile` */
export interface ProfileDto {
  userId: DbProfile["user_id"];
  displayName: DbProfile["display_name"];
  createdAt: DbProfile["created_at"] & IsoTimestamp;
  updatedAt: DbProfile["updated_at"] & IsoTimestamp;
}

/** Team: GET/POST/PATCH `/api/team` */
export interface TeamDto {
  teamId: DbTeam["team_id"];
  ownerId: DbTeam["owner_id"];
  name: DbTeam["name"];
  maxSavedCount: DbTeam["max_saved_count"];
  createdAt: DbTeam["created_at"] & IsoTimestamp;
  updatedAt: DbTeam["updated_at"] & IsoTimestamp;
}

/** Members: GET/POST/PATCH/DELETE `/api/members*` */
export interface MemberDto {
  memberId: DbMember["member_id"];
  teamId: DbMember["team_id"];
  displayName: DbMember["display_name"];
  initialOnCallCount: DbMember["initial_on_call_count"];
  createdAt: DbMember["created_at"] & IsoTimestamp;
  updatedAt: DbMember["updated_at"] & IsoTimestamp;
  deletedAt: DbMember["deleted_at"] & (IsoTimestamp | null);
}

export type MembersListStatus = "active" | "all";
export type MembersListSort = "createdAt" | "displayName";

export type MembersListQuery = PaginationParams & {
  status?: MembersListStatus;
  sort?: MembersListSort;
  order?: PaginationOrder;
};

/** Unavailabilities: GET/POST/DELETE `/api/unavailabilities*` */
export interface UnavailabilityDto {
  unavailabilityId: DbUnavailability["unavailability_id"];
  teamId: DbUnavailability["team_id"];
  memberId: DbUnavailability["member_id"];
  day: DbUnavailability["day"] & YyyyMmDd;
  createdAt: DbUnavailability["created_at"] & IsoTimestamp;
}

export type UnavailabilitiesListSort = "day";

export type UnavailabilitiesListQuery = PaginationParams & {
  startDate: YyyyMmDd;
  endDate: YyyyMmDd;
  memberId?: MemberId;
  sort?: UnavailabilitiesListSort;
  order?: PaginationOrder;
};

export type UnavailabilityOnConflict = "error" | "ignore";
export interface UnavailabilitiesCreateQuery {
  onConflict?: UnavailabilityOnConflict;
}

/** Plans: GET/POST `/api/plans*` */
export interface PlanDto {
  planId: DbPlan["plan_id"];
  teamId: DbPlan["team_id"];
  createdBy: DbPlan["created_by"];
  createdAt: DbPlan["created_at"] & IsoTimestamp;
  startDate: DbPlan["start_date"] & YyyyMmDd;
  endDate: DbPlan["end_date"] & YyyyMmDd;
  // DB has `date_range` but it is not exposed in the API.
}

export type PlansListSort = "createdAt" | "startDate";

export type PlansListQuery = PaginationParams & {
  startDate?: YyyyMmDd;
  endDate?: YyyyMmDd;
  sort?: PlansListSort;
  order?: PaginationOrder;
};

/** Plan assignments: GET `/api/plans/{planId}/assignments` */
export interface PlanAssignmentDto {
  planId: DbPlanAssignment["plan_id"];
  teamId: DbPlanAssignment["team_id"];
  day: DbPlanAssignment["day"] & YyyyMmDd;
  memberId: DbPlanAssignment["member_id"] | null;
  createdAt: DbPlanAssignment["created_at"] & IsoTimestamp;
}

export type PlanAssignmentsListSort = "day";

export type PlanAssignmentsListQuery = PaginationParams & {
  sort?: PlanAssignmentsListSort;
  order?: PaginationOrder;
};

/** Plan save: POST `/api/plans` (response) */
export interface PlanSavedSummaryDto {
  plan: Pick<PlanDto, "planId" | "startDate" | "endDate">;
  assignmentsCount: number;
  unassignedCount: number;
}

/** Plan preview (generator): POST `/api/plans/preview` */
export interface PlanPreviewAssignmentDto {
  day: YyyyMmDd;
  memberId: MemberId | null;
}

export interface PlanPreviewCounterDto {
  memberId: MemberId;
  displayName: MemberDto["displayName"];
  savedCount: number;
  previewCount: number;
  effectiveCount: number;
}

export interface PlanPreviewInequalityDto {
  historical: number;
  preview: number;
}

export interface PlanPreviewDto {
  startDate: YyyyMmDd;
  endDate: YyyyMmDd;
  rangeDays: number;
  assignments: PlanPreviewAssignmentDto[];
  counters: PlanPreviewCounterDto[];
  inequality: PlanPreviewInequalityDto;
  unassignedDays: YyyyMmDd[];
}

/** Stats: GET `/api/stats` and GET `/api/plans/{planId}/stats` */
export type StatsScope = "global" | "plan";

export interface StatsDaysDto {
  total: number;
  weekdays: number;
  weekends: number;
  unassigned: number;
}

export interface StatsMembersDto {
  min: number;
  max: number;
  inequality: number;
}

export interface StatsByMemberDto {
  memberId: MemberId;
  displayName: MemberDto["displayName"];
  assignedDays: number;
}

export interface StatsDtoGlobal {
  scope: "global";
  days: StatsDaysDto;
  members: StatsMembersDto;
  byMember: StatsByMemberDto[];
}

export interface StatsDtoPlan {
  scope: "plan";
  planId: PlanId;
  days: StatsDaysDto;
  members: StatsMembersDto;
  byMember: StatsByMemberDto[];
}

export type StatsDto = StatsDtoGlobal | StatsDtoPlan;

export interface StatsQuery {
  scope?: "global"; // MVP: only global supported on `/api/stats`
}

/** Events: GET `/api/events` */
export type KnownEventType = "plan_generated" | "plan_saved";

export interface EventDto {
  eventId: DbEvent["event_id"];
  teamId: DbEvent["team_id"];
  actorUserId: DbEvent["actor_user_id"];
  eventType: DbEvent["event_type"]; // DB-backed; clients can narrow to `KnownEventType` if desired
  occurredAt: DbEvent["occurred_at"] & IsoTimestamp;

  startDate: (DbEvent["start_date"] & YyyyMmDd) | null;
  endDate: (DbEvent["end_date"] & YyyyMmDd) | null;
  rangeDays: DbEvent["range_days"] | null;

  membersCount: DbEvent["members_count"] | null;
  unassignedCount: DbEvent["unassigned_count"] | null;
  inequality: DbEvent["inequality"] | null;

  durationMs: DbEvent["duration_ms"] | null;
  metadata: DbEvent["metadata"] & Json;
}

export type EventsListSort = "occurredAt";

export type EventsListQuery = PaginationParams & {
  eventType?: KnownEventType;
  startDate?: YyyyMmDd;
  endDate?: YyyyMmDd;
  sort?: EventsListSort;
  order?: PaginationOrder;
};

/** ---- Command Models (requests) ---- */

/** Profile commands */
export interface CreateProfileCommand {
  displayName: ProfileDto["displayName"];
}
export interface UpdateProfileCommand {
  displayName: ProfileDto["displayName"];
}

/** Team commands */
export interface CreateTeamCommand {
  name: TeamDto["name"];
}
export interface UpdateTeamCommand {
  name: TeamDto["name"];
}

/** Member commands */
export interface CreateMemberCommand {
  displayName: MemberDto["displayName"];
}
export interface UpdateMemberCommand {
  displayName: MemberDto["displayName"];
}

/** Unavailability commands */
export interface CreateUnavailabilityCommand {
  memberId: UnavailabilityDto["memberId"];
  day: UnavailabilityDto["day"];
}

/** Plan preview command */
export interface PlanPreviewCommand {
  startDate: YyyyMmDd;
  endDate: YyyyMmDd;
}

/** Plan save command */
export interface SavePlanCommand {
  startDate: YyyyMmDd;
  endDate: YyyyMmDd;
  assignments: Pick<PlanPreviewAssignmentDto, "day" | "memberId">[];
  durationMs: number;
}
