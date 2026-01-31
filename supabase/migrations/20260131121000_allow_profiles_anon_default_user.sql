-- migration: 20260131121000_allow_profiles_anon_default_user.sql
-- purpose:
--   allow anon access to profiles for the default user id during local/dev (no auth session).
-- affected objects:
--   policies on: public.profiles
-- notes:
--   - keeps rls enabled; only allows rows with the default user_id.
--   - intended for local/dev usage while auth is disabled.

begin;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_anon on public.profiles;
drop policy if exists profiles_insert_anon on public.profiles;
drop policy if exists profiles_update_anon on public.profiles;

create policy profiles_select_anon on public.profiles
  for select to anon
  using (user_id = '9609302b-599f-4d15-849c-28a8d197d8a8');

create policy profiles_insert_anon on public.profiles
  for insert to anon
  with check (user_id = '9609302b-599f-4d15-849c-28a8d197d8a8');

create policy profiles_update_anon on public.profiles
  for update to anon
  using (user_id = '9609302b-599f-4d15-849c-28a8d197d8a8')
  with check (user_id = '9609302b-599f-4d15-849c-28a8d197d8a8');

commit;
