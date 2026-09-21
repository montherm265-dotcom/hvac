-- Real RLS allow/deny tests, run as the `authenticated`/`anon` roles (never
-- as the table owner, which would bypass RLS and prove nothing). Each check
-- prints PASS/FAIL; a nonzero exit from run_rls_tests.sh means a FAIL line
-- was found. This is test-only scaffolding, not part of the app schema.

\set ON_ERROR_STOP on

create or replace function public.expect(label text, condition boolean)
returns void language plpgsql as $$
begin
  if condition then
    raise notice 'PASS: %', label;
  else
    raise exception 'FAIL: %', label;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as postgres, the table owner, which bypasses RLS —
-- this is just test setup, not something the app can do)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'carol@example.com');

insert into public.profiles (id, username, display_name, city, country_code) values
  ('00000000-0000-0000-0000-000000000001', 'alice', 'Alice', 'Lisbon', 'PT'),
  ('00000000-0000-0000-0000-000000000002', 'bob', 'Bob', 'Porto', 'PT'),
  ('00000000-0000-0000-0000-000000000003', 'carol', 'Carol', 'Faro', 'PT');

update public.privacy_settings set profile_visibility = 'private' where user_id = '00000000-0000-0000-0000-000000000003';

insert into public.missions (id, creator_id, title, description, visibility) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Public mission', 'A mission anyone can see and read about here', 'public'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000002', 'Private mission', 'A mission only bob and his crew can see right now', 'private');
insert into public.mission_members (mission_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'creator'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000002', 'creator');

insert into public.requests (id, requester_id, title, description, visibility) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'Need a hand', 'Need help moving a couch this weekend please', 'public');

-- ===========================================================================
-- Test as anon (no session at all)
-- ===========================================================================
set role anon;
select set_config('request.jwt.claim.sub', '', false);

select public.expect(
  'anon can read a public profile',
  exists (select 1 from public.profiles where username = 'alice')
);
select public.expect(
  'anon cannot read a private profile',
  not exists (select 1 from public.profiles where username = 'carol')
);
select public.expect(
  'anon can read a public mission',
  exists (select 1 from public.missions where id = '00000000-0000-0000-0000-0000000000a1')
);
select public.expect(
  'anon cannot read a private mission',
  not exists (select 1 from public.missions where id = '00000000-0000-0000-0000-0000000000a2')
);

do $$
begin
  begin
    insert into public.missions (creator_id, title, description) values ('00000000-0000-0000-0000-000000000001', 'Anon mission', 'anon trying to create a mission without being signed in');
    raise exception 'FAIL: anon should not be able to insert a mission';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: anon cannot insert a mission (%)', sqlerrm;
  end;
end $$;

reset role;

-- ===========================================================================
-- Test as Bob (authenticated, uuid ...002)
-- ===========================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);

select public.expect(
  'bob can read his own private mission',
  exists (select 1 from public.missions where id = '00000000-0000-0000-0000-0000000000a2')
);
select public.expect(
  'bob can read alice''s public mission',
  exists (select 1 from public.missions where id = '00000000-0000-0000-0000-0000000000a1')
);

do $$
begin
  begin
    update public.missions set title = 'Hijacked title' where id = '00000000-0000-0000-0000-0000000000a1';
    if exists (select 1 from public.missions where id = '00000000-0000-0000-0000-0000000000a1' and title = 'Hijacked title') then
      raise exception 'FAIL: bob updated alice''s mission';
    else
      raise notice 'PASS: bob''s update to alice''s mission affected zero rows';
    end if;
  end;
end $$;

do $$
begin
  begin
    perform public.set_mission_state('00000000-0000-0000-0000-0000000000a1', 'planning');
    raise exception 'FAIL: bob was able to change alice''s mission state via RPC';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: bob cannot change alice''s mission state via RPC (%)', sqlerrm;
  end;
end $$;

-- Bob tries to skip the state machine directly, bypassing set_mission_state()
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
begin
  begin
    update public.missions set state = 'completed' where id = '00000000-0000-0000-0000-0000000000a2';
    raise exception 'FAIL: bob jumped his own mission straight from idea to completed';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: raw UPDATE cannot skip the mission state machine (%)', sqlerrm;
  end;
end $$;

select public.expect(
  'bob can join alice''s public mission via RPC',
  (select (public.join_mission('00000000-0000-0000-0000-0000000000a1')).user_id = '00000000-0000-0000-0000-000000000002')
);
select public.expect(
  'bob is now a visible member of alice''s mission',
  exists (select 1 from public.mission_members where mission_id = '00000000-0000-0000-0000-0000000000a1' and user_id = '00000000-0000-0000-0000-000000000002')
);
select public.expect(
  'joining formed a relationship between bob and alice (Human Chains)',
  exists (select 1 from public.relationships where user_a_id = '00000000-0000-0000-0000-000000000001' and user_b_id = '00000000-0000-0000-0000-000000000002')
);

reset role;

-- ===========================================================================
-- Test as Carol (authenticated, uuid ...003) — the block/privacy paths
-- ===========================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);

select public.expect(
  'carol can read her own private profile',
  exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000003')
);

do $$
begin
  insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002');
end $$;

do $$
begin
  begin
    perform public.get_or_create_direct_conversation('00000000-0000-0000-0000-000000000002');
    raise exception 'FAIL: carol messaged someone who blocked/was blocked';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: blocked users cannot open a conversation (%)', sqlerrm;
  end;
end $$;

reset role;

-- Alice reads her own analytics; Bob must not see Alice's analytics
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select public.log_analytics_event('profile_viewed', '{"target":"test"}'::jsonb);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select public.expect(
  'bob cannot read alice''s analytics events',
  not exists (select 1 from public.analytics_events where user_id = '00000000-0000-0000-0000-000000000001')
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select public.expect(
  'alice can read her own analytics events',
  exists (select 1 from public.analytics_events where user_id = '00000000-0000-0000-0000-000000000001')
);
reset role;

-- ===========================================================================
-- Admin-only moderation path
-- ===========================================================================
insert into public.reports (id, reporter_id, target_type, target_id, reason) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'user', '00000000-0000-0000-0000-000000000002', 'test report reason text');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false); -- bob: not an admin
do $$
begin
  begin
    perform public.apply_moderation_action('00000000-0000-0000-0000-0000000000c1', 'warn', 'test');
    raise exception 'FAIL: a non-admin applied a moderation action';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: non-admins cannot apply moderation actions (%)', sqlerrm;
  end;
end $$;
reset role;

update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false); -- alice: now an admin
select public.expect(
  'an admin can apply a moderation action',
  (select action from public.apply_moderation_action('00000000-0000-0000-0000-0000000000c1', 'warn', 'test')) = 'warn'
);
reset role;

select 'ALL RLS TESTS PASSED' as result;
