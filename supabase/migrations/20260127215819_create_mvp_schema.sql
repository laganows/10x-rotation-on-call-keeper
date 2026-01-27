-- migration: 20260127215819_create_mvp_schema.sql
-- purpose:
--   create mvp schema for on-call rotation planner (teams, members, unavailabilities, plans, plan_assignments, events, profiles).
-- affected objects:
--   extensions: pgcrypto, btree_gist
--   tables: public.profiles, public.teams, public.members, public.unavailabilities, public.plans, public.plan_assignments, public.events
--   triggers/functions: public.set_updated_at()
--   constraints/indexes: unique constraints, fk constraints, check constraints, gist exclude constraint
-- notes:
--   - supabase auth users live in auth.users; do not create public.users.
--   - all sql is lowercase per project convention.
--   - rls is enabled for all domain tables. policies are intentionally granular:
--     separate policy per action (select/insert/update/delete) and per role (anon/authenticated).

begin;

-- ---------------------------------------------------------------------------
-- extensions required by this schema
-- ---------------------------------------------------------------------------
-- pgcrypto provides gen_random_uuid() used for primary keys.
create extension if not exists pgcrypto;

-- btree_gist is required for the exclude constraint on (team_id with =) + daterange overlap.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- shared trigger function: maintain updated_at on row updates
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'trigger helper: sets updated_at = now() on updates (immutable tables will simply not have update policies).';

-- ---------------------------------------------------------------------------
-- public.profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'minimal user profile for ui; one row per auth.users id.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- rls: profiles (own row only). anon has no access.
create policy profiles_select_anon on public.profiles
  for select to anon
  using (false);
comment on policy profiles_select_anon on public.profiles is
  'anon cannot read profiles.';

create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (user_id = auth.uid());
comment on policy profiles_select_authenticated on public.profiles is
  'authenticated can read only their own profile row.';

create policy profiles_insert_anon on public.profiles
  for insert to anon
  with check (false);
comment on policy profiles_insert_anon on public.profiles is
  'anon cannot create profiles.';

create policy profiles_insert_authenticated on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());
comment on policy profiles_insert_authenticated on public.profiles is
  'authenticated can create only their own profile row.';

create policy profiles_update_anon on public.profiles
  for update to anon
  using (false)
  with check (false);
comment on policy profiles_update_anon on public.profiles is
  'anon cannot update profiles.';

create policy profiles_update_authenticated on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
comment on policy profiles_update_authenticated on public.profiles is
  'authenticated can update only their own profile row (ownership enforced on both using and with check).';

create policy profiles_delete_anon on public.profiles
  for delete to anon
  using (false);
comment on policy profiles_delete_anon on public.profiles is
  'anon cannot delete profiles.';

create policy profiles_delete_authenticated on public.profiles
  for delete to authenticated
  using (user_id = auth.uid());
comment on policy profiles_delete_authenticated on public.profiles is
  'authenticated can delete only their own profile row (optional; auth deletion will cascade anyway).';

-- ---------------------------------------------------------------------------
-- public.teams (tenant boundary; mvp: 1 user = 1 team)
-- ---------------------------------------------------------------------------
create table public.teams (
  team_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My team',
  max_saved_count integer not null default 0 check (max_saved_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

comment on table public.teams is
  'tenant table; mvp uses unique(owner_id) to model one team per owner.';

create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

alter table public.teams enable row level security;

-- rls: teams (owner only). anon has no access.
create policy teams_select_anon on public.teams
  for select to anon
  using (false);
comment on policy teams_select_anon on public.teams is
  'anon cannot read teams.';

create policy teams_select_authenticated on public.teams
  for select to authenticated
  using (owner_id = auth.uid());
comment on policy teams_select_authenticated on public.teams is
  'authenticated can read only teams they own.';

create policy teams_insert_anon on public.teams
  for insert to anon
  with check (false);
comment on policy teams_insert_anon on public.teams is
  'anon cannot create teams.';

create policy teams_insert_authenticated on public.teams
  for insert to authenticated
  with check (owner_id = auth.uid());
comment on policy teams_insert_authenticated on public.teams is
  'authenticated can create a team only for themselves (owner_id must equal auth.uid()).';

create policy teams_update_anon on public.teams
  for update to anon
  using (false)
  with check (false);
comment on policy teams_update_anon on public.teams is
  'anon cannot update teams.';

create policy teams_update_authenticated on public.teams
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
comment on policy teams_update_authenticated on public.teams is
  'authenticated can update only teams they own.';

create policy teams_delete_anon on public.teams
  for delete to anon
  using (false);
comment on policy teams_delete_anon on public.teams is
  'anon cannot delete teams.';

create policy teams_delete_authenticated on public.teams
  for delete to authenticated
  using (owner_id = auth.uid());
comment on policy teams_delete_authenticated on public.teams is
  'authenticated can delete only teams they own (cascades to child records).';

-- ---------------------------------------------------------------------------
-- public.members (team members; soft-delete)
-- ---------------------------------------------------------------------------
create table public.members (
  member_id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(team_id) on delete cascade,
  display_name text not null,
  initial_on_call_count integer not null check (initial_on_call_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (team_id, member_id)
);

comment on table public.members is
  'team members; soft-delete via deleted_at. unique(team_id, member_id) supports composite fks from child tables.';

create index members_team_id_idx on public.members(team_id);
create index members_active_idx on public.members(team_id, member_id) where deleted_at is null;
create index members_active_for_ui_idx on public.members(team_id, display_name) where deleted_at is null;

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

alter table public.members enable row level security;

-- rls helper pattern (documented, kept inline for simplicity):
-- exists (select 1 from public.teams t where t.team_id = <table>.team_id and t.owner_id = auth.uid())

-- rls: members (team owner only). anon has no access.
create policy members_select_anon on public.members
  for select to anon
  using (false);
comment on policy members_select_anon on public.members is
  'anon cannot read members.';

create policy members_select_authenticated on public.members
  for select to authenticated
  using (exists (
    select 1 from public.teams t
    where t.team_id = members.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy members_select_authenticated on public.members is
  'authenticated can read members only within teams they own.';

create policy members_insert_anon on public.members
  for insert to anon
  with check (false);
comment on policy members_insert_anon on public.members is
  'anon cannot create members.';

create policy members_insert_authenticated on public.members
  for insert to authenticated
  with check (exists (
    select 1 from public.teams t
    where t.team_id = members.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy members_insert_authenticated on public.members is
  'authenticated can create members only within teams they own.';

create policy members_update_anon on public.members
  for update to anon
  using (false)
  with check (false);
comment on policy members_update_anon on public.members is
  'anon cannot update members.';

create policy members_update_authenticated on public.members
  for update to authenticated
  using (exists (
    select 1 from public.teams t
    where t.team_id = members.team_id
      and t.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.teams t
    where t.team_id = members.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy members_update_authenticated on public.members is
  'authenticated can update members only within teams they own (supports soft-delete by setting deleted_at).';

-- mvp: no delete (soft-delete instead); keep explicit deny policies for clarity.
create policy members_delete_anon on public.members
  for delete to anon
  using (false);
comment on policy members_delete_anon on public.members is
  'anon cannot delete members.';

create policy members_delete_authenticated on public.members
  for delete to authenticated
  using (false);
comment on policy members_delete_authenticated on public.members is
  'authenticated cannot hard-delete members in mvp; use deleted_at for soft-delete.';

-- ---------------------------------------------------------------------------
-- public.unavailabilities (member unavailability; single day)
-- ---------------------------------------------------------------------------
create table public.unavailabilities (
  unavailability_id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(team_id) on delete cascade,
  member_id uuid not null,
  day date not null,
  created_at timestamptz not null default now(),
  unique (team_id, member_id, day),
  foreign key (team_id, member_id) references public.members(team_id, member_id) on delete restrict
);

comment on table public.unavailabilities is
  'member unavailability by day; unique(team_id, member_id, day) prevents duplicates.';

create index unavailabilities_team_day_idx on public.unavailabilities(team_id, day);
create index unavailabilities_team_member_day_idx on public.unavailabilities(team_id, member_id, day);

alter table public.unavailabilities enable row level security;

-- rls: unavailabilities (team owner only). anon has no access.
create policy unavailabilities_select_anon on public.unavailabilities
  for select to anon
  using (false);
comment on policy unavailabilities_select_anon on public.unavailabilities is
  'anon cannot read unavailabilities.';

create policy unavailabilities_select_authenticated on public.unavailabilities
  for select to authenticated
  using (exists (
    select 1 from public.teams t
    where t.team_id = unavailabilities.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy unavailabilities_select_authenticated on public.unavailabilities is
  'authenticated can read unavailabilities only within teams they own.';

create policy unavailabilities_insert_anon on public.unavailabilities
  for insert to anon
  with check (false);
comment on policy unavailabilities_insert_anon on public.unavailabilities is
  'anon cannot create unavailabilities.';

create policy unavailabilities_insert_authenticated on public.unavailabilities
  for insert to authenticated
  with check (exists (
    select 1 from public.teams t
    where t.team_id = unavailabilities.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy unavailabilities_insert_authenticated on public.unavailabilities is
  'authenticated can create unavailabilities only within teams they own.';

-- typical workflow: delete + insert (no update in mvp).
create policy unavailabilities_update_anon on public.unavailabilities
  for update to anon
  using (false)
  with check (false);
comment on policy unavailabilities_update_anon on public.unavailabilities is
  'anon cannot update unavailabilities.';

create policy unavailabilities_update_authenticated on public.unavailabilities
  for update to authenticated
  using (false)
  with check (false);
comment on policy unavailabilities_update_authenticated on public.unavailabilities is
  'authenticated cannot update unavailabilities in mvp; use delete + insert for idempotent changes.';

create policy unavailabilities_delete_anon on public.unavailabilities
  for delete to anon
  using (false);
comment on policy unavailabilities_delete_anon on public.unavailabilities is
  'anon cannot delete unavailabilities.';

create policy unavailabilities_delete_authenticated on public.unavailabilities
  for delete to authenticated
  using (exists (
    select 1 from public.teams t
    where t.team_id = unavailabilities.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy unavailabilities_delete_authenticated on public.unavailabilities is
  'authenticated can delete unavailabilities only within teams they own.';

-- ---------------------------------------------------------------------------
-- public.plans (plan header; immutable after insert)
-- ---------------------------------------------------------------------------
create table public.plans (
  plan_id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(team_id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  start_date date not null,
  end_date date not null,
  date_range daterange generated always as (daterange(start_date, end_date, '[]')) stored,
  unique (team_id, plan_id),
  check (start_date <= end_date),
  check ((end_date - start_date + 1) between 1 and 365)
);

comment on table public.plans is
  'plan header; immutable after insert. date_range is stored daterange for overlap prevention.';

create index plans_team_created_at_idx on public.plans(team_id, created_at desc);
create index plans_team_start_end_idx on public.plans(team_id, start_date, end_date);

-- prevent overlapping plans within the same team at the database level (race-condition safe).
alter table public.plans
  add constraint plans_no_overlap
  exclude using gist (team_id with =, date_range with &&);

alter table public.plans enable row level security;

-- rls: plans (team owner can select/insert; no update/delete). anon has no access.
create policy plans_select_anon on public.plans
  for select to anon
  using (false);
comment on policy plans_select_anon on public.plans is
  'anon cannot read plans.';

create policy plans_select_authenticated on public.plans
  for select to authenticated
  using (exists (
    select 1 from public.teams t
    where t.team_id = plans.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy plans_select_authenticated on public.plans is
  'authenticated can read plans only within teams they own.';

create policy plans_insert_anon on public.plans
  for insert to anon
  with check (false);
comment on policy plans_insert_anon on public.plans is
  'anon cannot create plans.';

create policy plans_insert_authenticated on public.plans
  for insert to authenticated
  with check (
    exists (
      select 1 from public.teams t
      where t.team_id = plans.team_id
        and t.owner_id = auth.uid()
    )
    and created_by = auth.uid()
  );
comment on policy plans_insert_authenticated on public.plans is
  'authenticated can create plans only for teams they own and only as themselves (created_by = auth.uid()).';

create policy plans_update_anon on public.plans
  for update to anon
  using (false)
  with check (false);
comment on policy plans_update_anon on public.plans is
  'anon cannot update plans.';

create policy plans_update_authenticated on public.plans
  for update to authenticated
  using (false)
  with check (false);
comment on policy plans_update_authenticated on public.plans is
  'plans are immutable in mvp; no updates allowed.';

create policy plans_delete_anon on public.plans
  for delete to anon
  using (false);
comment on policy plans_delete_anon on public.plans is
  'anon cannot delete plans.';

create policy plans_delete_authenticated on public.plans
  for delete to authenticated
  using (false);
comment on policy plans_delete_authenticated on public.plans is
  'plans are immutable in mvp; no deletes allowed (keep history).';

-- ---------------------------------------------------------------------------
-- public.plan_assignments (one row per day; member_id null means unassigned)
-- ---------------------------------------------------------------------------
create table public.plan_assignments (
  team_id uuid not null,
  plan_id uuid not null,
  day date not null,
  member_id uuid,
  created_at timestamptz not null default now(),
  primary key (plan_id, day),
  foreign key (team_id, plan_id) references public.plans(team_id, plan_id) on delete cascade,
  foreign key (team_id, member_id) references public.members(team_id, member_id) on delete restrict
);

comment on table public.plan_assignments is
  'plan day assignments; member_id null represents unassigned. immutable after insert. note: enforce day within plan range at api/rpc layer (or add a trigger later).';

create index plan_assignments_team_day_idx on public.plan_assignments(team_id, day);
create index plan_assignments_team_member_day_idx on public.plan_assignments(team_id, member_id, day);
create index plan_assignments_plan_id_idx on public.plan_assignments(plan_id);

alter table public.plan_assignments enable row level security;

-- rls: plan_assignments (team owner can select/insert; no update/delete). anon has no access.
create policy plan_assignments_select_anon on public.plan_assignments
  for select to anon
  using (false);
comment on policy plan_assignments_select_anon on public.plan_assignments is
  'anon cannot read plan assignments.';

create policy plan_assignments_select_authenticated on public.plan_assignments
  for select to authenticated
  using (exists (
    select 1 from public.teams t
    where t.team_id = plan_assignments.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy plan_assignments_select_authenticated on public.plan_assignments is
  'authenticated can read plan assignments only within teams they own.';

create policy plan_assignments_insert_anon on public.plan_assignments
  for insert to anon
  with check (false);
comment on policy plan_assignments_insert_anon on public.plan_assignments is
  'anon cannot create plan assignments.';

create policy plan_assignments_insert_authenticated on public.plan_assignments
  for insert to authenticated
  with check (exists (
    select 1 from public.teams t
    where t.team_id = plan_assignments.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy plan_assignments_insert_authenticated on public.plan_assignments is
  'authenticated can create plan assignments only within teams they own; member_id may be null to indicate unassigned.';

create policy plan_assignments_update_anon on public.plan_assignments
  for update to anon
  using (false)
  with check (false);
comment on policy plan_assignments_update_anon on public.plan_assignments is
  'anon cannot update plan assignments.';

create policy plan_assignments_update_authenticated on public.plan_assignments
  for update to authenticated
  using (false)
  with check (false);
comment on policy plan_assignments_update_authenticated on public.plan_assignments is
  'plan assignments are immutable in mvp; no updates allowed.';

create policy plan_assignments_delete_anon on public.plan_assignments
  for delete to anon
  using (false);
comment on policy plan_assignments_delete_anon on public.plan_assignments is
  'anon cannot delete plan assignments.';

create policy plan_assignments_delete_authenticated on public.plan_assignments
  for delete to authenticated
  using (false);
comment on policy plan_assignments_delete_authenticated on public.plan_assignments is
  'plan assignments are immutable in mvp; no deletes allowed (keep history).';

-- ---------------------------------------------------------------------------
-- public.events (instrumentation; immutable)
-- ---------------------------------------------------------------------------
create table public.events (
  event_id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(team_id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('plan_generated', 'plan_saved')),
  occurred_at timestamptz not null default now(),
  start_date date,
  end_date date,
  range_days integer check (range_days is null or range_days between 1 and 365),
  members_count integer check (members_count is null or members_count >= 0),
  unassigned_count integer check (unassigned_count is null or unassigned_count >= 0),
  inequality integer check (inequality is null or inequality >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.events is
  'instrumentation events for analytics/debugging; immutable after insert.';

create index events_team_occurred_at_idx on public.events(team_id, occurred_at desc);
create index events_team_type_occurred_at_idx on public.events(team_id, event_type, occurred_at desc);

alter table public.events enable row level security;

-- rls: events (team owner can select/insert; no update/delete). anon has no access.
create policy events_select_anon on public.events
  for select to anon
  using (false);
comment on policy events_select_anon on public.events is
  'anon cannot read events.';

create policy events_select_authenticated on public.events
  for select to authenticated
  using (exists (
    select 1 from public.teams t
    where t.team_id = events.team_id
      and t.owner_id = auth.uid()
  ));
comment on policy events_select_authenticated on public.events is
  'authenticated can read events only within teams they own.';

create policy events_insert_anon on public.events
  for insert to anon
  with check (false);
comment on policy events_insert_anon on public.events is
  'anon cannot create events.';

create policy events_insert_authenticated on public.events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.teams t
      where t.team_id = events.team_id
        and t.owner_id = auth.uid()
    )
    and actor_user_id = auth.uid()
  );
comment on policy events_insert_authenticated on public.events is
  'authenticated can create events only within teams they own and only as themselves (actor_user_id = auth.uid()).';

create policy events_update_anon on public.events
  for update to anon
  using (false)
  with check (false);
comment on policy events_update_anon on public.events is
  'anon cannot update events.';

create policy events_update_authenticated on public.events
  for update to authenticated
  using (false)
  with check (false);
comment on policy events_update_authenticated on public.events is
  'events are immutable in mvp; no updates allowed.';

create policy events_delete_anon on public.events
  for delete to anon
  using (false);
comment on policy events_delete_anon on public.events is
  'anon cannot delete events.';

create policy events_delete_authenticated on public.events
  for delete to authenticated
  using (false);
comment on policy events_delete_authenticated on public.events is
  'events are immutable in mvp; no deletes allowed (keep history).';

commit;

