-- Minimal shim reproducing the parts of Supabase's platform that the
-- migrations depend on (auth.users, auth.uid(), the anon/authenticated
-- roles, and default grants), so the real migrations can be applied
-- unmodified against a plain local Postgres for RLS testing. This file is
-- test-only infrastructure — it is never applied to a real Supabase
-- project, which already provides all of this.

create schema if not exists auth;

create table auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public, auth to anon, authenticated;
