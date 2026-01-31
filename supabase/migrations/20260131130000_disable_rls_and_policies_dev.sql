-- migration: 20260131130000_disable_rls_and_policies_dev.sql
-- purpose:
--   dev-only: disable rls AND drop all rls policies so local development can run without auth/session.
-- affected objects:
--   - policies on all public tables (dropped dynamically)
--   - rls on all public tables (disabled dynamically)
-- notes:
--   - this is intentionally broad (affects all current and future public tables).
--   - do NOT use this in production environments.

begin;

do $$
declare
  pol record;
  tbl record;
begin
  -- drop every policy in public schema (no need to know policy names)
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  end loop;

  -- disable rls for every public table
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I no force row level security;', tbl.tablename);
    execute format('alter table public.%I disable row level security;', tbl.tablename);
  end loop;
end $$;

commit;

