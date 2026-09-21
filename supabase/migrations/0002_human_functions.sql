-- HUMAN business logic: triggers + security-definer RPCs.
-- Keeping real invariants (transition legality, block enforcement, notification fan-out)
-- in the database, not just the client, since RLS alone can't express them cleanly.

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

create or replace function public.set_mission_state(p_mission_id uuid, p_new_state public.mission_state)
returns public.missions
language plpgsql security definer set search_path = public as $$
declare
  v_mission public.missions;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if v_mission is null then
    raise exception 'mission not found';
  end if;
  if v_mission.creator_id <> auth.uid() then
    raise exception 'only the mission creator can change its state';
  end if;
  if not public.is_legal_mission_transition(v_mission.state, p_new_state) then
    raise exception 'illegal transition from % to %', v_mission.state, p_new_state;
  end if;

  update public.missions set state = p_new_state where id = p_mission_id
    returning * into v_mission;

  insert into public.notifications (user_id, type, payload)
  select mp.user_id, 'mission_state_changed', jsonb_build_object(
    'mission_id', v_mission.id, 'title', v_mission.title, 'state', v_mission.state
  )
  from public.mission_participants mp
  where mp.mission_id = v_mission.id and mp.user_id <> auth.uid();

  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join / leave a mission
-- ---------------------------------------------------------------------------
create or replace function public.join_mission(p_mission_id uuid)
returns public.mission_participants
language plpgsql security definer set search_path = public as $$
declare
  v_mission public.missions;
  v_current_crew integer;
  v_row public.mission_participants;
begin
  select * into v_mission from public.missions where id = p_mission_id;
  if v_mission is null then
    raise exception 'mission not found';
  end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = v_mission.creator_id and blocked_id = auth.uid())
       or (blocker_id = auth.uid() and blocked_id = v_mission.creator_id)
  ) then
    raise exception 'unable to join this mission';
  end if;

  if v_mission.crew_limit is not null then
    select count(*) into v_current_crew from public.mission_participants where mission_id = p_mission_id;
    if v_current_crew >= v_mission.crew_limit then
      raise exception 'this mission''s crew is full';
    end if;
  end if;

  insert into public.mission_participants (mission_id, user_id, role)
  values (p_mission_id, auth.uid(), 'crew')
  on conflict (mission_id, user_id) do nothing
  returning * into v_row;

  if v_row.user_id is not null then
    insert into public.notifications (user_id, type, payload)
    values (v_mission.creator_id, 'mission_joined', jsonb_build_object(
      'mission_id', v_mission.id, 'title', v_mission.title, 'user_id', auth.uid()
    ));
  end if;

  return v_row;
end;
$$;

create or replace function public.leave_mission(p_mission_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.mission_participants
  where mission_id = p_mission_id and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------------
create or replace function public.complete_milestone(p_milestone_id uuid)
returns public.mission_milestones
language plpgsql security definer set search_path = public as $$
declare
  v_row public.mission_milestones;
  v_mission_id uuid;
  v_title text;
begin
  select mission_id, title into v_mission_id, v_title from public.mission_milestones where id = p_milestone_id;
  if v_mission_id is null then
    raise exception 'milestone not found';
  end if;
  if not exists (
    select 1 from public.missions m
    where m.id = v_mission_id and (
      m.creator_id = auth.uid()
      or exists (select 1 from public.mission_participants mp where mp.mission_id = m.id and mp.user_id = auth.uid())
    )
  ) then
    raise exception 'not a participant of this mission';
  end if;

  update public.mission_milestones
  set is_done = true, completed_at = now()
  where id = p_milestone_id
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select mp.user_id, 'milestone_completed', jsonb_build_object(
    'mission_id', v_mission_id, 'milestone_id', p_milestone_id, 'title', v_title
  )
  from public.mission_participants mp
  where mp.mission_id = v_mission_id and mp.user_id <> auth.uid();

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moments: notify participants on new moment
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_new_moment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, payload)
  select mp.user_id, 'new_moment', jsonb_build_object(
    'mission_id', new.mission_id, 'moment_id', new.id, 'author_id', new.author_id
  )
  from public.mission_participants mp
  where mp.mission_id = new.mission_id and mp.user_id <> new.author_id;
  return new;
end;
$$;

create trigger moments_notify after insert on public.moments
  for each row execute function public.notify_on_new_moment();

-- ---------------------------------------------------------------------------
-- Messages: notify the other participant(s)
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, payload)
  select cp.user_id, 'new_message', jsonb_build_object(
    'conversation_id', new.conversation_id, 'message_id', new.id, 'sender_id', new.sender_id
  )
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id;
  return new;
end;
$$;

create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_on_new_message();

-- ---------------------------------------------------------------------------
-- Direct conversations
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_conversation_id uuid;
begin
  if p_other_user_id = auth.uid() then
    raise exception 'cannot message yourself';
  end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = auth.uid())
  ) then
    raise exception 'unable to message this user';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where not c.is_group
    and c.mission_id is null
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = auth.uid())
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = p_other_user_id)
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (is_group) values (false) returning id into v_conversation_id;
  insert into public.conversation_participants (conversation_id, user_id) values
    (v_conversation_id, auth.uid()),
    (v_conversation_id, p_other_user_id);

  return v_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Needs You: rule-based matching (documented as v1; real semantic matching
-- needs an LLM/embeddings provider — see README "Roadmap").
-- ---------------------------------------------------------------------------
create or replace function public.get_matching_needs(p_limit integer default 20)
returns table (
  need_id uuid,
  mission_id uuid,
  mission_title text,
  skill_needed text,
  description text,
  matched_skill text
)
language sql security definer set search_path = public stable as $$
  select n.id, n.mission_id, m.title, n.skill_needed, n.description, p.matched
  from public.mission_needs n
  join public.missions m on m.id = n.mission_id
  join public.profiles me on me.id = auth.uid()
  cross join lateral (
    select skill as matched from unnest(me.skills) as skill
    where lower(skill) = lower(n.skill_needed)
    limit 1
  ) p
  where not n.is_filled
    and m.creator_id <> auth.uid()
    and not exists (select 1 from public.mission_participants mp where mp.mission_id = m.id and mp.user_id = auth.uid())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = m.creator_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = m.creator_id)
    )
  order by n.created_at desc
  limit p_limit;
$$;
