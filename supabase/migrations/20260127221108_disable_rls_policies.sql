-- migration: 20260127221108_disable_rls_policies.sql
-- purpose:
--   disable all row level security (rls) policies previously defined by migrations.
-- affected objects:
--   policies on: public.profiles, public.teams, public.members, public.unavailabilities,
--                public.plans, public.plan_assignments, public.events
-- notes:
--   - this migration does not disable rls itself; it only drops policies.
--   - with rls enabled and no policies, access will be denied for non-bypass roles (anon/authenticated),
--     which is often useful for maintenance or when switching to a different auth model.
--   - destructive operation: dropping policies changes authorization behavior immediately.

begin;

-- ---------------------------------------------------------------------------
-- public.profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_anon on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_insert_anon on public.profiles;
drop policy if exists profiles_insert_authenticated on public.profiles;
drop policy if exists profiles_update_anon on public.profiles;
drop policy if exists profiles_update_authenticated on public.profiles;
drop policy if exists profiles_delete_anon on public.profiles;
drop policy if exists profiles_delete_authenticated on public.profiles;

-- ---------------------------------------------------------------------------
-- public.teams
-- ---------------------------------------------------------------------------
drop policy if exists teams_select_anon on public.teams;
drop policy if exists teams_select_authenticated on public.teams;
drop policy if exists teams_insert_anon on public.teams;
drop policy if exists teams_insert_authenticated on public.teams;
drop policy if exists teams_update_anon on public.teams;
drop policy if exists teams_update_authenticated on public.teams;
drop policy if exists teams_delete_anon on public.teams;
drop policy if exists teams_delete_authenticated on public.teams;

-- ---------------------------------------------------------------------------
-- public.members
-- ---------------------------------------------------------------------------
drop policy if exists members_select_anon on public.members;
drop policy if exists members_select_authenticated on public.members;
drop policy if exists members_insert_anon on public.members;
drop policy if exists members_insert_authenticated on public.members;
drop policy if exists members_update_anon on public.members;
drop policy if exists members_update_authenticated on public.members;
drop policy if exists members_delete_anon on public.members;
drop policy if exists members_delete_authenticated on public.members;

-- ---------------------------------------------------------------------------
-- public.unavailabilities
-- ---------------------------------------------------------------------------
drop policy if exists unavailabilities_select_anon on public.unavailabilities;
drop policy if exists unavailabilities_select_authenticated on public.unavailabilities;
drop policy if exists unavailabilities_insert_anon on public.unavailabilities;
drop policy if exists unavailabilities_insert_authenticated on public.unavailabilities;
drop policy if exists unavailabilities_update_anon on public.unavailabilities;
drop policy if exists unavailabilities_update_authenticated on public.unavailabilities;
drop policy if exists unavailabilities_delete_anon on public.unavailabilities;
drop policy if exists unavailabilities_delete_authenticated on public.unavailabilities;

-- ---------------------------------------------------------------------------
-- public.plans
-- ---------------------------------------------------------------------------
drop policy if exists plans_select_anon on public.plans;
drop policy if exists plans_select_authenticated on public.plans;
drop policy if exists plans_insert_anon on public.plans;
drop policy if exists plans_insert_authenticated on public.plans;
drop policy if exists plans_update_anon on public.plans;
drop policy if exists plans_update_authenticated on public.plans;
drop policy if exists plans_delete_anon on public.plans;
drop policy if exists plans_delete_authenticated on public.plans;

-- ---------------------------------------------------------------------------
-- public.plan_assignments
-- ---------------------------------------------------------------------------
drop policy if exists plan_assignments_select_anon on public.plan_assignments;
drop policy if exists plan_assignments_select_authenticated on public.plan_assignments;
drop policy if exists plan_assignments_insert_anon on public.plan_assignments;
drop policy if exists plan_assignments_insert_authenticated on public.plan_assignments;
drop policy if exists plan_assignments_update_anon on public.plan_assignments;
drop policy if exists plan_assignments_update_authenticated on public.plan_assignments;
drop policy if exists plan_assignments_delete_anon on public.plan_assignments;
drop policy if exists plan_assignments_delete_authenticated on public.plan_assignments;

-- ---------------------------------------------------------------------------
-- public.events
-- ---------------------------------------------------------------------------
drop policy if exists events_select_anon on public.events;
drop policy if exists events_select_authenticated on public.events;
drop policy if exists events_insert_anon on public.events;
drop policy if exists events_insert_authenticated on public.events;
drop policy if exists events_update_anon on public.events;
drop policy if exists events_update_authenticated on public.events;
drop policy if exists events_delete_anon on public.events;
drop policy if exists events_delete_authenticated on public.events;

commit;

