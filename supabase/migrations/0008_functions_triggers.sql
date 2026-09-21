-- HUMAN business logic: rate limiting, the mission state machine, Human
-- Chains formation, the rule-based matching/routing engine, reputation
-- rollups, live-mission lifecycle, and moderation actions. Kept in the
-- database (not the client) so every write path enforces the same
-- invariants regardless of what calls it.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger missions_touch_updated_at before update on public.missions
  for each row execute function public.touch_updated_at();
create trigger requests_touch_updated_at before update on public.requests
  for each row execute function public.touch_updated_at();
create trigger relationships_touch_updated_at before update on public.relationships
  for each row execute function public.touch_updated_at();

-- Every profile gets a default privacy_settings row the moment it's created,
-- so every later join against it (matching, messaging) can rely on it existing.
create or replace function public.create_default_privacy_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.privacy_settings (user_id) values (new.id);
  return new;
end;
$$;
create trigger profiles_default_privacy after insert on public.profiles
  for each row execute function public.create_default_privacy_settings();

-- Used by the profiles RLS policy. Deliberately SECURITY DEFINER: a plain
-- subquery on privacy_settings/relationships from inside another table's
-- policy would itself be RLS-gated to "rows about me", which silently
-- breaks visibility checks about *other* people — this function reads the
-- real settings once, as the table owner, and returns just a boolean.
create or replace function public.can_view_profile(p_target uuid)
returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  v_visibility text;
begin
  if p_target = auth.uid() then return true; end if;

  select profile_visibility into v_visibility from public.privacy_settings where user_id = p_target;
  if v_visibility is null or v_visibility = 'public' then return true; end if;
  if v_visibility = 'private' then return false; end if;

  return exists (
    select 1 from public.relationships
    where user_a_id = least(auth.uid(), p_target) and user_b_id = greatest(auth.uid(), p_target)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting: a real enforced ceiling, not a UI debounce. Buckets by a
-- fixed window start (e.g. the current hour) so it's cheap to check/upsert.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_action text, p_max_count integer, p_window_seconds integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  -- No authenticated caller means this write came from the service role /
  -- an internal migration or admin path, not an end user — nothing to limit.
  if auth.uid() is null then
    return;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, v_window_start, 1)
  on conflict (user_id, action, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;

  if v_count > p_max_count then
    raise exception 'rate_limit_exceeded: % (max % per %s)', p_action, p_max_count, p_window_seconds;
  end if;
end;
$$;

create or replace function public.enforce_request_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.check_rate_limit('create_request', 5, 3600);
  return new;
end;
$$;

create trigger requests_rate_limit before insert on public.requests
  for each row execute function public.enforce_request_rate_limit();

create or replace function public.enforce_report_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.check_rate_limit('create_report', 10, 3600);
  return new;
end;
$$;

create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.enforce_report_rate_limit();

-- ---------------------------------------------------------------------------
-- Analytics + discovery signal logging (thin, callable from the client)
-- ---------------------------------------------------------------------------
create or replace function public.log_analytics_event(p_event_type text, p_payload jsonb default '{}')
returns void
language sql security definer set search_path = public as $$
  insert into public.analytics_events (user_id, event_type, payload) values (auth.uid(), p_event_type, p_payload);
$$;

create or replace function public.record_discovery_signal(p_signal_type text, p_subject_id uuid default null, p_subject_type text default null, p_weight numeric default 1)
returns void
language sql security definer set search_path = public as $$
  insert into public.discovery_signals (user_id, signal_type, subject_id, subject_type, weight)
  values (auth.uid(), p_signal_type, p_subject_id, p_subject_type, p_weight);
$$;

-- ---------------------------------------------------------------------------
-- Relationships (Human Chains): formed automatically by doing things
-- together, never by "following". Canonicalizes (a,b) ordering and
-- increases strength on repeat formation instead of duplicating rows.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_relationship(p_user_x uuid, p_user_y uuid, p_kind text, p_mission_id uuid default null, p_request_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a uuid; v_b uuid; v_resulting_strength integer;
begin
  if p_user_x = p_user_y then return; end if;
  v_a := least(p_user_x, p_user_y);
  v_b := greatest(p_user_x, p_user_y);

  insert into public.relationships (user_a_id, user_b_id, kind, formed_via_mission_id, formed_via_request_id)
  values (v_a, v_b, p_kind, p_mission_id, p_request_id)
  on conflict (user_a_id, user_b_id) do update set strength = relationships.strength + 1
  returning strength into v_resulting_strength;

  -- strength = 1 only ever happens on the initial insert (conflicts always increment from >=1), so it's a safe new-row check.
  if v_resulting_strength = 1 then
    insert into public.notifications (user_id, type, payload)
    values
      (v_a, 'relationship_formed', jsonb_build_object('with_user_id', v_b)),
      (v_b, 'relationship_formed', jsonb_build_object('with_user_id', v_a));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mission state machine
-- ---------------------------------------------------------------------------
create or replace function public.is_legal_mission_transition(from_state public.mission_state, to_state public.mission_state)
returns boolean language sql immutable as $$
  select case
    when from_state = to_state then true
    when from_state = 'idea' and to_state in ('planning', 'archived') then true
    when from_state = 'planning' and to_state in ('active', 'paused', 'archived') then true
    when from_state = 'active' and to_state in ('progress', 'paused', 'archived') then true
    when from_state = 'progress' and to_state in ('near_completion', 'paused', 'archived') then true
    when from_state = 'near_completion' and to_state in ('completed', 'progress', 'paused') then true
    when from_state = 'paused' and to_state in ('planning', 'active', 'progress', 'archived') then true
    else false
  end;
$$;

-- Defense in depth: the same legality check applies at the table level too,
-- not just inside set_mission_state() below, so a raw client UPDATE can
-- never skip straight from 'idea' to 'completed' even if it bypasses the
-- RPC. (It still won't get the RPC's events/notifications/reputation side
-- effects — going through set_mission_state() is what the UI does.)
create or replace function public.enforce_mission_state_transition()
returns trigger language plpgsql as $$
begin
  if new.state <> old.state and not public.is_legal_mission_transition(old.state, new.state) then
    raise exception 'illegal transition from % to %', old.state, new.state;
  end if;
  return new;
end;
$$;
create trigger missions_enforce_state_transition before update on public.missions
  for each row execute function public.enforce_mission_state_transition();

-- Used by both missions' own RLS policy and every mission-child table's
-- policy (mission_members, milestones, needs, moments, media, events, live
-- sessions). Must be SECURITY DEFINER: missions' policy needing to check
-- mission_members, and mission_members' policy needing to check missions,
-- is a direct two-table RLS cycle if either does it via a plain RLS-gated
-- subquery — Postgres correctly refuses that with "infinite recursion
-- detected in policy". This function computes the answer once against the
-- raw tables (bypassing RLS as the owner) and hands back a plain boolean,
-- which breaks the cycle for every caller.
create or replace function public.can_view_mission(p_mission_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.missions m
    left join public.mission_members mm on mm.mission_id = m.id and mm.user_id = auth.uid() and mm.left_at is null
    where m.id = p_mission_id and (
      m.creator_id = auth.uid()
      or m.visibility = 'public'
      or mm.user_id is not null
      or (m.visibility = 'connections' and exists (
        select 1 from public.relationships r
        where r.user_a_id = least(auth.uid(), m.creator_id) and r.user_b_id = greatest(auth.uid(), m.creator_id)
      ))
    )
  );
$$;

-- Small helper for the many "creator or active crew can write" policies below.
create or replace function public.is_active_mission_member(p_mission_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.missions m where m.id = p_mission_id and (
      m.creator_id = auth.uid()
      or exists (select 1 from public.mission_members mm where mm.mission_id = m.id and mm.user_id = auth.uid() and mm.left_at is null)
    )
  );
$$;

create or replace function public.set_mission_state(p_mission_id uuid, p_new_state public.mission_state)
returns public.missions
language plpgsql security definer set search_path = public as $$
declare
  v_mission public.missions;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if v_mission is null then raise exception 'mission not found'; end if;
  if v_mission.creator_id <> auth.uid() then raise exception 'only the mission creator can change its state'; end if;
  if not public.is_legal_mission_transition(v_mission.state, p_new_state) then
    raise exception 'illegal transition from % to %', v_mission.state, p_new_state;
  end if;

  update public.missions set state = p_new_state where id = p_mission_id returning * into v_mission;

  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (p_mission_id, auth.uid(), 'state_changed', jsonb_build_object('state', p_new_state));

  insert into public.notifications (user_id, type, payload)
  select mm.user_id, 'mission_state_changed', jsonb_build_object('mission_id', v_mission.id, 'title', v_mission.title, 'state', v_mission.state)
  from public.mission_members mm where mm.mission_id = v_mission.id and mm.user_id <> auth.uid() and mm.left_at is null;

  if p_new_state = 'completed' then
    insert into public.reputation_events (user_id, event_type, weight, mission_id)
    select mm.user_id, 'mission_completed', 2, v_mission.id
    from public.mission_members mm where mm.mission_id = v_mission.id and mm.left_at is null;
  end if;

  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join / leave a mission
-- ---------------------------------------------------------------------------
create or replace function public.join_mission(p_mission_id uuid)
returns public.mission_members
language plpgsql security definer set search_path = public as $$
declare
  v_mission public.missions;
  v_current_crew integer;
  v_row public.mission_members;
  v_existing_member uuid;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if v_mission is null then raise exception 'mission not found'; end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = v_mission.creator_id and blocked_id = auth.uid())
       or (blocker_id = auth.uid() and blocked_id = v_mission.creator_id)
  ) then raise exception 'unable to join this mission'; end if;

  if v_mission.crew_limit is not null then
    select count(*) into v_current_crew from public.mission_members where mission_id = p_mission_id and left_at is null;
    if v_current_crew >= v_mission.crew_limit then raise exception 'this mission''s crew is full'; end if;
  end if;

  insert into public.mission_members (mission_id, user_id, role)
  values (p_mission_id, auth.uid(), 'crew')
  on conflict (mission_id, user_id) do update set left_at = null
  returning * into v_row;

  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (p_mission_id, auth.uid(), 'member_joined', '{}');

  insert into public.notifications (user_id, type, payload)
  values (v_mission.creator_id, 'mission_joined', jsonb_build_object('mission_id', v_mission.id, 'title', v_mission.title, 'user_id', auth.uid()));

  for v_existing_member in
    select user_id from public.mission_members where mission_id = p_mission_id and user_id <> auth.uid() and left_at is null
  loop
    perform public.upsert_relationship(auth.uid(), v_existing_member, 'mission_crew', p_mission_id, null);
  end loop;

  return v_row;
end;
$$;

create or replace function public.leave_mission(p_mission_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.mission_members set left_at = now() where mission_id = p_mission_id and user_id = auth.uid();
  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (p_mission_id, auth.uid(), 'member_left', '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Milestones, needs, moments: log a mission_event + notify on insert/update
-- ---------------------------------------------------------------------------
create or replace function public.notify_milestone_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (new.mission_id, auth.uid(), 'milestone_added', jsonb_build_object('milestone_id', new.id, 'title', new.title));
  return new;
end;
$$;
create trigger mission_milestones_notify after insert on public.mission_milestones
  for each row execute function public.notify_milestone_added();

create or replace function public.complete_milestone(p_milestone_id uuid)
returns public.mission_milestones
language plpgsql security definer set search_path = public as $$
declare
  v_row public.mission_milestones;
  v_mission_id uuid; v_title text;
begin
  select mission_id, title into v_mission_id, v_title from public.mission_milestones where id = p_milestone_id;
  if v_mission_id is null then raise exception 'milestone not found'; end if;
  if not exists (
    select 1 from public.missions m
    where m.id = v_mission_id and (
      m.creator_id = auth.uid()
      or exists (select 1 from public.mission_members mm where mm.mission_id = m.id and mm.user_id = auth.uid() and mm.left_at is null)
    )
  ) then raise exception 'not a participant of this mission'; end if;

  update public.mission_milestones set is_done = true, completed_at = now(), completed_by = auth.uid()
  where id = p_milestone_id returning * into v_row;

  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (v_mission_id, auth.uid(), 'milestone_completed', jsonb_build_object('milestone_id', p_milestone_id, 'title', v_title));

  insert into public.notifications (user_id, type, payload)
  select mm.user_id, 'milestone_completed', jsonb_build_object('mission_id', v_mission_id, 'milestone_id', p_milestone_id, 'title', v_title)
  from public.mission_members mm where mm.mission_id = v_mission_id and mm.user_id <> auth.uid() and mm.left_at is null;

  insert into public.reputation_events (user_id, event_type, weight, mission_id)
  values (auth.uid(), 'milestone_completed', 0.5, v_mission_id);

  return v_row;
end;
$$;

create or replace function public.notify_need_posted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (new.mission_id, auth.uid(), 'need_posted', jsonb_build_object('need_id', new.id));
  return new;
end;
$$;
create trigger mission_needs_notify after insert on public.mission_needs
  for each row execute function public.notify_need_posted();

create or replace function public.notify_on_new_moment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (new.mission_id, new.author_id, 'moment_posted', jsonb_build_object('moment_id', new.id));

  insert into public.notifications (user_id, type, payload)
  select mm.user_id, 'new_moment', jsonb_build_object('mission_id', new.mission_id, 'moment_id', new.id, 'author_id', new.author_id)
  from public.mission_members mm where mm.mission_id = new.mission_id and mm.user_id <> new.author_id and mm.left_at is null;
  return new;
end;
$$;
create trigger moments_notify after insert on public.moments
  for each row execute function public.notify_on_new_moment();

create or replace function public.notify_media_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (new.mission_id, new.uploaded_by, 'media_added', jsonb_build_object('media_id', new.id, 'media_type', new.media_type));
  return new;
end;
$$;
create trigger mission_media_notify after insert on public.mission_media
  for each row execute function public.notify_media_added();

-- ---------------------------------------------------------------------------
-- Messages: notify + block enforcement + connections-only privacy
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, payload)
  select cp.user_id, 'new_message', jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id, 'sender_id', new.sender_id)
  from public.conversation_participants cp where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id;
  return new;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_on_new_message();

create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_conversation_id uuid;
  v_other_permissions text;
  v_connected boolean;
begin
  if p_other_user_id = auth.uid() then raise exception 'cannot message yourself'; end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = auth.uid())
  ) then raise exception 'unable to message this user'; end if;

  select message_permissions into v_other_permissions from public.privacy_settings where user_id = p_other_user_id;
  if v_other_permissions = 'connections_only' then
    select exists (
      select 1 from public.relationships
      where (user_a_id = least(auth.uid(), p_other_user_id) and user_b_id = greatest(auth.uid(), p_other_user_id))
    ) into v_connected;
    if not v_connected then raise exception 'this person only accepts messages from connections'; end if;
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where not c.is_group and c.mission_id is null
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = auth.uid())
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = p_other_user_id)
  limit 1;

  if v_conversation_id is not null then return v_conversation_id; end if;

  insert into public.conversations (is_group) values (false) returning id into v_conversation_id;
  insert into public.conversation_participants (conversation_id, user_id) values
    (v_conversation_id, auth.uid()), (v_conversation_id, p_other_user_id);

  perform public.log_analytics_event('meaningful_conversation_started', jsonb_build_object('conversation_id', v_conversation_id, 'other_user_id', p_other_user_id));
  return v_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Needs You: rule-based matching against normalized profile_skills.
-- ---------------------------------------------------------------------------
create or replace function public.get_matching_needs(p_limit integer default 20)
returns table (need_id uuid, mission_id uuid, mission_title text, skill_label text, description text)
language sql security definer set search_path = public stable as $$
  select n.id, n.mission_id, m.title, s.label, n.description
  from public.mission_needs n
  join public.missions m on m.id = n.mission_id
  join public.skills s on s.id = n.skill_id
  where not n.is_filled
    and m.creator_id <> auth.uid()
    and exists (select 1 from public.profile_skills ps where ps.profile_id = auth.uid() and ps.skill_id = n.skill_id and ps.mode in ('can_help', 'both'))
    and not exists (select 1 from public.mission_members mm where mm.mission_id = m.id and mm.user_id = auth.uid() and mm.left_at is null)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = m.creator_id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = m.creator_id)
    )
  order by n.created_at desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- ASK HUMAN: rule-based request-routing engine. Deterministic and
-- explainable today; the `semantic-match` edge function is a drop-in
-- upgrade that inserts algorithm='semantic' rows into the same table.
-- ---------------------------------------------------------------------------
create or replace function public.run_matching_for_request(p_request_id uuid)
returns setof public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_request public.requests;
begin
  select * into v_request from public.requests where id = p_request_id;
  if v_request is null then raise exception 'request not found'; end if;
  if v_request.requester_id <> auth.uid() then raise exception 'only the requester can trigger matching'; end if;

  return query
  with scored as (
    select
      p.id as candidate_id,
      least(1.0,
        coalesce((
          select 0.4 from public.profile_skills ps join public.skills s on s.id = ps.skill_id
          where ps.profile_id = p.id and ps.mode in ('can_help', 'both')
            and (v_request.title || ' ' || v_request.description) ilike '%' || s.label || '%'
          limit 1
        ), 0)
        + coalesce((
          select 0.25 from public.lived_experiences le
          where le.profile_id = p.id and le.is_public
            and (v_request.title || ' ' || v_request.description) ilike '%' || le.category || '%'
          limit 1
        ), 0)
        + coalesce((
          select 0.2 from public.profile_interests pi join public.interests i on i.id = pi.interest_id
          join public.categories c on c.id = v_request.category_id
          where pi.profile_id = p.id and i.slug = c.slug
          limit 1
        ), 0)
        + case when v_request.location_scope <> 'remote' and p.city is not null and v_request.city is not null
               and lower(p.city) = lower(v_request.city) then 0.2 else 0 end
      ) as score
    from public.profiles p
    join public.privacy_settings pv on pv.user_id = p.id
    where p.id <> v_request.requester_id
      and pv.allow_matching
      and p.status = 'active'
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_request.requester_id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = v_request.requester_id)
      )
  )
  insert into public.matches (request_id, candidate_id, score, reason, algorithm)
  select p_request_id, candidate_id, score, jsonb_build_object('scored_by', 'rule_based_v1'), 'rule_based'
  from scored where score >= 0.2
  on conflict (request_id, candidate_id) do update set score = excluded.score
  returning *;
end;
$$;

create or replace function public.notify_after_matching()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, payload)
  values (new.candidate_id, 'request_matched', jsonb_build_object('request_id', new.request_id, 'match_id', new.id));
  perform public.log_analytics_event('request_matched', jsonb_build_object('request_id', new.request_id, 'candidate_id', new.candidate_id));
  return new;
end;
$$;
create trigger matches_notify after insert on public.matches
  for each row execute function public.notify_after_matching();

create or replace function public.respond_to_match(p_match_id uuid, p_accept boolean)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches;
  v_request public.requests;
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match is null then raise exception 'match not found'; end if;
  if v_match.candidate_id <> auth.uid() then raise exception 'only the matched candidate can respond'; end if;

  update public.matches set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_match_id returning * into v_match;

  select * into v_request from public.requests where id = v_match.request_id;

  if p_accept then
    update public.requests set status = 'matched' where id = v_request.id and status = 'open';
    perform public.upsert_relationship(v_request.requester_id, auth.uid(), 'match_accepted', null, v_request.id);
    perform public.get_or_create_direct_conversation(v_request.requester_id);

    insert into public.notifications (user_id, type, payload)
    values (v_request.requester_id, 'introduction_made', jsonb_build_object('request_id', v_request.id, 'candidate_id', auth.uid()));

    insert into public.reputation_events (user_id, event_type, weight, request_id) values
      (auth.uid(), 'help_given', 1, v_request.id),
      (v_request.requester_id, 'help_received', 1, v_request.id);

    perform public.log_analytics_event('match_accepted', jsonb_build_object('match_id', p_match_id));
    perform public.log_analytics_event('introduction_made', jsonb_build_object('match_id', p_match_id));
    perform public.log_analytics_event('help_given', jsonb_build_object('request_id', v_request.id));
    perform public.log_analytics_event('help_received', jsonb_build_object('request_id', v_request.id));
  end if;

  return v_match;
end;
$$;

create or replace function public.convert_request_to_mission(p_request_id uuid, p_crew_limit integer default null)
returns public.missions
language plpgsql security definer set search_path = public as $$
declare
  v_request public.requests;
  v_mission public.missions;
begin
  select * into v_request from public.requests where id = p_request_id;
  if v_request is null then raise exception 'request not found'; end if;
  if v_request.requester_id <> auth.uid() then raise exception 'only the requester can convert this into a mission'; end if;
  if v_request.converted_to_mission_id is not null then raise exception 'already converted'; end if;

  insert into public.missions (creator_id, title, description, category_id, city, country_code, crew_limit, origin_request_id)
  values (v_request.requester_id, v_request.title, v_request.description, v_request.category_id, v_request.city, v_request.country_code, p_crew_limit, v_request.id)
  returning * into v_mission;

  insert into public.mission_members (mission_id, user_id, role) values (v_mission.id, v_request.requester_id, 'creator');
  insert into public.mission_events (mission_id, actor_id, event_type, payload) values (v_mission.id, auth.uid(), 'created', '{}');

  update public.requests set converted_to_mission_id = v_mission.id, status = 'in_progress' where id = p_request_id;

  insert into public.notifications (user_id, type, payload)
  select m.candidate_id, 'mission_joined', jsonb_build_object('mission_id', v_mission.id, 'title', v_mission.title)
  from public.matches m where m.request_id = p_request_id and m.status = 'accepted';

  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- Human Chains: real 2-hop graph traversal over the relationships table.
-- ---------------------------------------------------------------------------
create or replace function public.get_human_chain_suggestions(p_limit integer default 10)
returns table (candidate_id uuid, username citext, display_name text, avatar_url text, shared_connections bigint)
language sql security definer set search_path = public stable as $$
  with my_connections as (
    select case when user_a_id = auth.uid() then user_b_id else user_a_id end as friend_id
    from public.relationships where auth.uid() in (user_a_id, user_b_id)
  ),
  second_degree as (
    select
      case when r.user_a_id = mc.friend_id then r.user_b_id else r.user_a_id end as candidate_id,
      count(*) as shared_connections
    from public.relationships r
    join my_connections mc on mc.friend_id in (r.user_a_id, r.user_b_id)
    group by 1
  )
  select p.id, p.username, p.display_name, p.avatar_url, sd.shared_connections
  from second_degree sd
  join public.profiles p on p.id = sd.candidate_id
  where sd.candidate_id <> auth.uid()
    and sd.candidate_id not in (select friend_id from my_connections)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by sd.shared_connections desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Peer skill verification: a real trust signal, only grantable by someone
-- who actually shared a completed mission with the target.
-- ---------------------------------------------------------------------------
create or replace function public.verify_peer_skill(p_target_user_id uuid, p_skill_id uuid)
returns public.identity_verifications
language plpgsql security definer set search_path = public as $$
declare
  v_skill_slug text;
  v_row public.identity_verifications;
begin
  if p_target_user_id = auth.uid() then raise exception 'cannot verify your own skill'; end if;
  if not exists (
    select 1 from public.mission_members a
    join public.mission_members b on a.mission_id = b.mission_id
    join public.missions m on m.id = a.mission_id
    where a.user_id = auth.uid() and b.user_id = p_target_user_id and m.state = 'completed'
  ) then raise exception 'you can only verify skills for people you completed a mission with'; end if;

  select slug into v_skill_slug from public.skills where id = p_skill_id;

  insert into public.identity_verifications (user_id, kind, value, status, verifier_id, verified_at)
  values (p_target_user_id, 'peer_skill_reference', v_skill_slug, 'verified', auth.uid(), now())
  returning * into v_row;

  insert into public.reputation_events (user_id, event_type, weight) values (p_target_user_id, 'peer_skill_verified', 0.5);

  insert into public.notifications (user_id, type, payload)
  values (p_target_user_id, 'peer_skill_verified', jsonb_build_object('skill', v_skill_slug, 'verifier_id', auth.uid()));

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reputation rollup: recompute on every ledger write. Cheap enough at V1
-- scale; swap for a scheduled batch job before it isn't.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_reputation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := new.user_id;
begin
  insert into public.reputation_scores (user_id, missions_completed, help_given_count, help_received_count, reliability_score, last_computed_at)
  select
    v_user_id,
    count(*) filter (where event_type = 'mission_completed'),
    count(*) filter (where event_type = 'help_given'),
    count(*) filter (where event_type = 'help_received'),
    least(100, greatest(0, 50 + sum(weight))),
    now()
  from public.reputation_events where user_id = v_user_id
  on conflict (user_id) do update set
    missions_completed = excluded.missions_completed,
    help_given_count = excluded.help_given_count,
    help_received_count = excluded.help_received_count,
    reliability_score = excluded.reliability_score,
    last_computed_at = excluded.last_computed_at;
  return new;
end;
$$;
create trigger reputation_events_recompute after insert on public.reputation_events
  for each row execute function public.recompute_reputation();

-- ---------------------------------------------------------------------------
-- Live Missions lifecycle. start_live_session/end_live_session/etc. are
-- called by the client (host only); mark_live_session_live is called by the
-- create-live-stream edge function using the service role once the real
-- Cloudflare Stream live input exists, so it deliberately bypasses the
-- "caller must be a host" check other functions apply.
-- ---------------------------------------------------------------------------
create or replace function public.start_live_session(p_mission_id uuid)
returns public.live_sessions
language plpgsql security definer set search_path = public as $$
declare
  v_row public.live_sessions;
begin
  if not exists (
    select 1 from public.mission_members where mission_id = p_mission_id and user_id = auth.uid() and role in ('creator', 'co_host') and left_at is null
  ) then raise exception 'only the mission creator or a co-host can start a live session'; end if;

  insert into public.live_sessions (mission_id, created_by) values (p_mission_id, auth.uid()) returning * into v_row;
  insert into public.live_session_hosts (live_session_id, user_id, role) values (v_row.id, auth.uid(), 'host');
  return v_row;
end;
$$;

create or replace function public.mark_live_session_live(p_live_session_id uuid, p_provider_stream_id text, p_provider_playback_id text, p_playback_url text default null)
returns public.live_sessions
language plpgsql security definer set search_path = public as $$
declare
  v_row public.live_sessions;
begin
  update public.live_sessions
  set status = 'live', started_at = now(), provider_stream_id = p_provider_stream_id, provider_playback_id = p_provider_playback_id, playback_url = p_playback_url
  where id = p_live_session_id returning * into v_row;

  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (v_row.mission_id, v_row.created_by, 'live_started', jsonb_build_object('live_session_id', v_row.id));

  insert into public.notifications (user_id, type, payload)
  select mm.user_id, 'live_mission_started', jsonb_build_object('mission_id', v_row.mission_id, 'live_session_id', v_row.id)
  from public.mission_members mm where mm.mission_id = v_row.mission_id and mm.user_id <> v_row.created_by and mm.left_at is null;

  return v_row;
end;
$$;

create or replace function public.end_live_session(p_live_session_id uuid, p_recording_url text default null)
returns public.live_sessions
language plpgsql security definer set search_path = public as $$
declare
  v_row public.live_sessions;
begin
  if not exists (select 1 from public.live_session_hosts where live_session_id = p_live_session_id and user_id = auth.uid()) then
    raise exception 'only a host can end this session';
  end if;

  update public.live_sessions set status = 'ended', ended_at = now(), recording_url = p_recording_url
  where id = p_live_session_id returning * into v_row;

  insert into public.mission_events (mission_id, actor_id, event_type, payload)
  values (v_row.mission_id, auth.uid(), 'live_ended', jsonb_build_object('live_session_id', v_row.id));

  return v_row;
end;
$$;

create or replace function public.request_to_help_live(p_live_session_id uuid, p_message text default null)
returns public.live_join_requests
language plpgsql security definer set search_path = public as $$
declare
  v_row public.live_join_requests;
  v_mission_id uuid;
begin
  select mission_id into v_mission_id from public.live_sessions where id = p_live_session_id;

  insert into public.live_join_requests (live_session_id, user_id, message)
  values (p_live_session_id, auth.uid(), p_message)
  on conflict (live_session_id, user_id) do update set message = excluded.message, status = 'pending', responded_at = null
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select lsh.user_id, 'live_join_requested', jsonb_build_object('live_session_id', p_live_session_id, 'user_id', auth.uid())
  from public.live_session_hosts lsh where lsh.live_session_id = p_live_session_id;

  return v_row;
end;
$$;

create or replace function public.respond_to_live_join_request(p_request_id uuid, p_accept boolean)
returns public.live_join_requests
language plpgsql security definer set search_path = public as $$
declare
  v_row public.live_join_requests;
  v_mission_id uuid;
begin
  select ljr.* into v_row from public.live_join_requests ljr where ljr.id = p_request_id;
  if v_row is null then raise exception 'help request not found'; end if;
  select ls.mission_id into v_mission_id from public.live_sessions ls where ls.id = v_row.live_session_id;

  if not exists (select 1 from public.live_session_hosts where live_session_id = v_row.live_session_id and user_id = auth.uid()) then
    raise exception 'only a host can respond to help requests';
  end if;

  update public.live_join_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_request_id returning * into v_row;

  if p_accept then
    insert into public.mission_members (mission_id, user_id, role) values (v_mission_id, v_row.user_id, 'crew')
    on conflict (mission_id, user_id) do update set left_at = null;
    perform public.log_analytics_event('viewer_became_participant', jsonb_build_object('mission_id', v_mission_id, 'user_id', v_row.user_id));
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------
create or replace function public.apply_moderation_action(p_report_id uuid, p_action text, p_notes text default null)
returns public.moderation_actions
language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports;
  v_action public.moderation_actions;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'admin only';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report is null then raise exception 'report not found'; end if;

  insert into public.moderation_actions (report_id, target_type, target_id, action, actor_id, notes)
  values (p_report_id, v_report.target_type, v_report.target_id, p_action, auth.uid(), p_notes)
  returning * into v_action;

  if p_action = 'suspend_user' and v_report.target_type = 'user' then
    update public.profiles set status = 'suspended' where id = v_report.target_id;
  elsif p_action = 'ban_user' and v_report.target_type = 'user' then
    update public.profiles set status = 'banned' where id = v_report.target_id;
  elsif p_action = 'remove_content' and v_report.target_type = 'moment' then
    delete from public.moments where id = v_report.target_id;
  elsif p_action = 'remove_content' and v_report.target_type = 'mission' then
    update public.missions set state = 'archived' where id = v_report.target_id;
  elsif p_action = 'remove_content' and v_report.target_type = 'message' then
    delete from public.messages where id = v_report.target_id;
  end if;

  if p_action in ('suspend_user', 'ban_user') then
    insert into public.reputation_events (user_id, event_type, weight) values (v_report.target_id, 'report_upheld_against', -5);
  end if;

  update public.reports set status = (case when p_action = 'dismiss' then 'dismissed' else 'resolved' end)::public.report_status, resolved_at = now(), resolved_by = auth.uid()
  where id = p_report_id;

  return v_action;
end;
$$;
