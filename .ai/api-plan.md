# REST API Plan

## 1. Resources
- Profile — `public.profiles`
- Team — `public.teams`
- Member — `public.members`
- Unavailability — `public.unavailabilities`
- Plan — `public.plans`
- Plan assignment — `public.plan_assignments`
- Event — `public.events`

## 2. Endpoints

### Common conventions
- Base URL: `/api`
- Content type: `application/json`
- Date fields use `YYYY-MM-DD` (UTC). Timestamps use ISO 8601 (UTC).
- Pagination: `limit` (default 50, max 200), `offset` (default 0), `sort`, `order`.
- Standard error shape:
  - ```json
    {
      "error": {
        "code": "validation_error",
        "message": "Human readable message.",
        "details": { "field": "reason" }
      }
    }
    ```

### Profile

**GET `/api/profile`**  
Get current user profile.
- Query: none
- Response 200:
  - ```json
    {
      "data": {
        "userId": "uuid",
        "displayName": "string|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    }
    ```
- Errors: 401, 404

**POST `/api/profile`**  
Create profile for current user (idempotent).
- Request:
  - ```json
    { "displayName": "string|null" }
    ```
- Response 201 (or 200 if exists): same as GET
- Errors: 400, 401, 409

**PATCH `/api/profile`**  
Update current user profile.
- Request:
  - ```json
    { "displayName": "string|null" }
    ```
- Response 200: same as GET
- Errors: 400, 401

### Team (MVP: one team per owner)

**GET `/api/team`**  
Get the current user’s team.
- Response 200:
  - ```json
    {
      "data": {
        "teamId": "uuid",
        "ownerId": "uuid",
        "name": "string",
        "maxSavedCount": 0,
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    }
    ```
- Errors: 401, 404

**POST `/api/team`**  
Create team for current user (one per owner).
- Request:
  - ```json
    { "name": "string" }
    ```
- Response 201: same as GET
- Errors: 400, 401, 409

**PATCH `/api/team`**  
Update team name (no direct update of `maxSavedCount`).
- Request:
  - ```json
    { "name": "string" }
    ```
- Response 200: same as GET
- Errors: 400, 401

### Members

**GET `/api/members`**  
List members.
- Query:
  - `status=active|all` (default `active`)
  - `limit`, `offset`, `sort=createdAt|displayName`, `order=asc|desc`
- Response 200:
  - ```json
    {
      "data": [
        {
          "memberId": "uuid",
          "teamId": "uuid",
          "displayName": "string",
          "initialOnCallCount": 0,
          "createdAt": "timestamp",
          "updatedAt": "timestamp",
          "deletedAt": "timestamp|null"
        }
      ],
      "page": { "limit": 50, "offset": 0, "total": 123 }
    }
    ```
- Errors: 401

**POST `/api/members`**  
Create member (initialOnCallCount = team.maxSavedCount).
- Request:
  - ```json
    { "displayName": "string" }
    ```
- Response 201: member shape above
- Errors: 400, 401, 422

**PATCH `/api/members/{memberId}`**  
Update display data only.
- Request:
  - ```json
    { "displayName": "string" }
    ```
- Response 200: member shape above
- Errors: 400, 401, 404

**DELETE `/api/members/{memberId}`**  
Soft-delete member (sets `deletedAt`).
- Response 204
- Errors: 401, 404, 409

### Unavailabilities

**GET `/api/unavailabilities`**  
List unavailabilities in range.
- Query:
  - `startDate` (required), `endDate` (required)
  - `memberId` (optional)
  - `limit`, `offset`, `sort=day`, `order=asc|desc`
- Response 200:
  - ```json
    {
      "data": [
        {
          "unavailabilityId": "uuid",
          "teamId": "uuid",
          "memberId": "uuid",
          "day": "YYYY-MM-DD",
          "createdAt": "timestamp"
        }
      ],
      "page": { "limit": 50, "offset": 0, "total": 123 }
    }
    ```
- Errors: 400, 401

**POST `/api/unavailabilities`**  
Create unavailability (unique per member/day).
- Query:
  - `onConflict=error|ignore` (default `error`)
- Request:
  - ```json
    { "memberId": "uuid", "day": "YYYY-MM-DD" }
    ```
- Response 201: unavailability shape above
- Errors: 400, 401, 404, 409

**DELETE `/api/unavailabilities/{unavailabilityId}`**  
Delete unavailability.
- Response 204
- Errors: 401, 404

### Plans (saved)

**GET `/api/plans`**  
List saved plans.
- Query:
  - `startDate` (optional), `endDate` (optional)
  - `limit`, `offset`, `sort=createdAt|startDate`, `order=asc|desc`
- Response 200:
  - ```json
    {
      "data": [
        {
          "planId": "uuid",
          "teamId": "uuid",
          "createdBy": "uuid",
          "createdAt": "timestamp",
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD"
        }
      ],
      "page": { "limit": 50, "offset": 0, "total": 123 }
    }
    ```
- Errors: 401

**GET `/api/plans/{planId}`**  
Get plan header.
- Response 200: plan shape above
- Errors: 401, 404

**GET `/api/plans/{planId}/assignments`**  
Get plan assignments.
- Query:
  - `limit`, `offset`, `sort=day`, `order=asc|desc`
- Response 200:
  - ```json
    {
      "data": [
        {
          "planId": "uuid",
          "teamId": "uuid",
          "day": "YYYY-MM-DD",
          "memberId": "uuid|null",
          "createdAt": "timestamp"
        }
      ],
      "page": { "limit": 50, "offset": 0, "total": 365 }
    }
    ```
- Errors: 401, 404

**POST `/api/plans`**  
Save a generated plan (immutable).
- Request:
  - ```json
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "assignments": [
        { "day": "YYYY-MM-DD", "memberId": "uuid|null" }
      ],
      "durationMs": 1234
    }
    ```
- Response 201:
  - ```json
    {
      "data": {
        "plan": { "planId": "uuid", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
        "assignmentsCount": 30,
        "unassignedCount": 2
      }
    }
    ```
- Errors: 400, 401, 409, 422
- Behavior:
  - Inserts plan and assignments in one transaction.
  - Updates `teams.max_saved_count`.
  - Creates `events` row with `plan_saved`.

### Plan preview (generator)

**POST `/api/plans/preview`**  
Generate deterministic preview without persisting a plan.
- Request:
  - ```json
    { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
    ```
- Response 200:
  - ```json
    {
      "data": {
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "rangeDays": 30,
        "assignments": [
          { "day": "YYYY-MM-DD", "memberId": "uuid|null" }
        ],
        "counters": [
          {
            "memberId": "uuid",
            "displayName": "string",
            "savedCount": 4,
            "previewCount": 2,
            "effectiveCount": 6
          }
        ],
        "inequality": { "historical": 1, "preview": 2 },
        "unassignedDays": ["YYYY-MM-DD"]
      }
    }
    ```
- Errors: 400, 401, 422
- Behavior:
  - Skips members with `deletedAt` and unavailability in day.
  - Adds `events` row with `plan_generated`.

### Stats

**GET `/api/stats`**  
Global stats across saved plans.
- Query:
  - `scope=global` (default)
- Response 200:
  - ```json
    {
      "data": {
        "scope": "global",
        "days": { "total": 120, "weekdays": 85, "weekends": 35, "unassigned": 4 },
        "members": { "min": 6, "max": 9, "inequality": 3 },
        "byMember": [
          { "memberId": "uuid", "displayName": "string", "assignedDays": 9 }
        ]
      }
    }
    ```
- Errors: 401

**GET `/api/stats/plans/{planId}`**  
Stats for a single plan.
- Response 200: same shape as `/api/stats` with `scope: "plan"` and `planId`
- Errors: 401, 404

### Events (optional for analytics UI)

**GET `/api/events`**  
List instrumentation events.
- Query:
  - `eventType=plan_generated|plan_saved` (optional)
  - `startDate`, `endDate` (optional)
  - `limit`, `offset`, `sort=occurredAt`, `order=asc|desc`
- Response 200:
  - ```json
    {
      "data": [
        {
          "eventId": "uuid",
          "teamId": "uuid",
          "actorUserId": "uuid",
          "eventType": "plan_saved",
          "occurredAt": "timestamp",
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD",
          "rangeDays": 30,
          "membersCount": 5,
          "unassignedCount": 2,
          "inequality": 1,
          "durationMs": 1200,
          "metadata": {}
        }
      ],
      "page": { "limit": 50, "offset": 0, "total": 123 }
    }
    ```
- Errors: 401

## 3. Authentication and Authorization
- Supabase Auth (OAuth) provides JWTs; API requires `Authorization: Bearer <jwt>` or Supabase session cookie.
- Astro middleware enforces auth on `/api/*` except explicitly public endpoints (none in MVP).
- Row Level Security (RLS) on all domain tables ensures tenant isolation:
  - Access is limited to rows where `teams.owner_id = auth.uid()` and matching `team_id`.
- Authorization is implicit via RLS; API should still validate ownership before inserts for clearer errors.

## 4. Validation and Business Logic

### Cross-cutting validations
- All UUIDs must be valid and belong to the current team.
- All date ranges are inclusive, UTC-based, and must satisfy `1 <= rangeDays <= 365`.
- `startDate` must be >= today (UTC).
- Use early guards for invalid inputs and return `400`/`422`.

### Profiles
- `displayName` optional, trimmed, max length (e.g., 100).

### Teams
- `name` required on create, non-empty after trim.
- `maxSavedCount` is server-managed; no direct client updates.
- Only one team per owner; creation should return `409` if already exists.

### Members
- `displayName` required on create, non-empty.
- `initialOnCallCount` is set to `teams.max_saved_count` on create.
- Soft delete only (`deletedAt`), no hard delete.
- `deletedAt IS NULL` members are active; generator excludes deleted members.

### Unavailabilities
- Unique constraint `(team_id, member_id, day)`:
  - default behavior returns `409`.
  - with `onConflict=ignore`, returns `200` and existing row.
- Day must be within a reasonable range (e.g., today .. today+365) to match generator rules.
- `memberId` must be active (not soft-deleted).

### Plans
- `startDate <= endDate` and range 1–365 days.
- No overlapping plans in a team (enforced by DB EXCLUDE constraint).
- Plan save is immutable: no update/delete endpoints.
- Assignments must:
  - Cover every day in the range exactly once.
  - Have `memberId` either `null` (UNASSIGNED) or an active member in the same team.
  - Have `day` within `[startDate, endDate]`.
- Save operation must be transactional:
  - Insert plan header.
  - Insert assignments.
  - Update `teams.max_saved_count`.
  - Insert `events` row (`plan_saved`).

### Plan preview (generator)
- Deterministic assignment:
  - Choose lowest `effectiveCount = initialOnCallCount + savedCount + previewCount`.
  - Tie-breaker is ascending `memberId`.
- Skip members with unavailability on that day.
- If no available member, assign `UNASSIGNED` (`memberId = null`).
- Calculate:
  - `savedCount` from historic assignments.
  - `previewCount` from current preview.
  - `inequality` as max-min for historical and preview.
  - `unassignedDays` list and count.
- Insert `events` row (`plan_generated`) with metrics and duration.

### Stats
- Weekend is Saturday/Sunday in UTC.
- Include `UNASSIGNED` as separate category.
- Inequality computed as `maxAssigned - minAssigned` among active members.

