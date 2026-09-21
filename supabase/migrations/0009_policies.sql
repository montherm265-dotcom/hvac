-- Row-level security policies for every table. Written last, after every
-- table exists, so cross-domain policies (e.g. profile visibility depending
-- on the relationships graph) don't need forward references. See
-- supabase/tests/rls_test.sql for allowed/denied-path tests run against a
-- local Postgres instance mirroring these policies.
--
-- Convention used throughout: tables with no write policy for a role are
-- writable only through the SECURITY DEFINER functions in
-- 0008_functions_triggers.sql, which run as the table owner and so bypass
-- RLS by design — that's how join_mission(), respond_to_match(), etc. are
-- allowed to enforce invariants (block checks, crew limits, rate limits)
-- that a client-facing INSERT policy could not express on its own.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles visible per privacy setting" on public.profiles for select
  using (public.can_view_profile(id));
create policy "users insert their own profile" on public.profiles for insert with check (id = auth.uid());
create policy "users update their own profile" on public.profiles for update using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- identity_verifications: full rows (incl. PII like email/phone value) are
-- visible only to the owner; verified peer-skill references are safe to
-- show publicly since their value is just a skill slug.
-- ---------------------------------------------------------------------------
create policy "own verifications or public peer skill refs" on public.identity_verifications for select
  using (user_id = auth.uid() or (status = 'verified' and kind = 'peer_skill_reference'));

-- ---------------------------------------------------------------------------
-- skills / interests: open, public taxonomy
-- ---------------------------------------------------------------------------
create policy "skills are publicly readable" on public.skills for select using (true);
create policy "authenticated users can add skills" on public.skills for insert with check (auth.uid() is not null);

create policy "interests are publicly readable" on public.interests for select using (true);
create policy "authenticated users can add interests" on public.interests for insert with check (auth.uid() is not null);

create policy "profile_skills are publicly readable" on public.profile_skills for select using (true);
create policy "users manage their own skills" on public.profile_skills for insert with check (profile_id = auth.uid());
create policy "users remove their own skills" on public.profile_skills for delete using (profile_id = auth.uid());

create policy "profile_interests are publicly readable" on public.profile_interests for select using (true);
create policy "users manage their own interests" on public.profile_interests for insert with check (profile_id = auth.uid());
create policy "users remove their own interests" on public.profile_interests for delete using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- lived_experiences
-- ---------------------------------------------------------------------------
create policy "public lived experiences or own" on public.lived_experiences for select
  using (is_public or profile_id = auth.uid());
create policy "users manage their own lived experiences" on public.lived_experiences for insert with check (profile_id = auth.uid());
create policy "users update their own lived experiences" on public.lived_experiences for update using (profile_id = auth.uid());
create policy "users delete their own lived experiences" on public.lived_experiences for delete using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- privacy_settings: strictly private to the owner (other code paths read it
-- via SECURITY DEFINER functions, which bypass RLS)
-- ---------------------------------------------------------------------------
create policy "users see only their own privacy settings" on public.privacy_settings for select using (user_id = auth.uid());
create policy "users manage their own privacy settings" on public.privacy_settings for update using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create policy "categories are publicly readable" on public.categories for select using (true);

-- ---------------------------------------------------------------------------
-- requests
-- ---------------------------------------------------------------------------
create policy "requests visible per visibility setting" on public.requests for select
  using (
    requester_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'connections' and exists (
      select 1 from public.relationships r
      where r.user_a_id = least(auth.uid(), requester_id) and r.user_b_id = greatest(auth.uid(), requester_id)
    ))
  );
create policy "users create their own requests" on public.requests for insert with check (requester_id = auth.uid());
create policy "users update their own requests" on public.requests for update using (requester_id = auth.uid());
create policy "users delete their own requests" on public.requests for delete using (requester_id = auth.uid());

-- ---------------------------------------------------------------------------
-- matches: visible to the candidate and the requester; written only by
-- run_matching_for_request() / respond_to_match()
-- ---------------------------------------------------------------------------
create policy "matches visible to candidate or requester" on public.matches for select
  using (
    candidate_id = auth.uid()
    or exists (select 1 from public.requests r where r.id = request_id and r.requester_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- discovery_signals / rate_limits
-- ---------------------------------------------------------------------------
create policy "users see their own discovery signals" on public.discovery_signals for select using (user_id = auth.uid());
create policy "users record their own discovery signals" on public.discovery_signals for insert with check (user_id = auth.uid());

create policy "users see their own rate limit usage" on public.rate_limits for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- missions
-- ---------------------------------------------------------------------------
create policy "missions visible per visibility setting" on public.missions for select
  using (public.can_view_mission(id));
create policy "users create missions" on public.missions for insert with check (creator_id = auth.uid());
create policy "creators update their missions" on public.missions for update using (creator_id = auth.uid());
create policy "creators delete their missions" on public.missions for delete using (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- mission_members: readable by anyone who can read the mission; writable
-- only through join_mission()/leave_mission()/convert_request_to_mission()
-- ---------------------------------------------------------------------------
create policy "members readable via mission visibility" on public.mission_members for select
  using (public.can_view_mission(mission_id));

-- ---------------------------------------------------------------------------
-- mission_milestones
-- ---------------------------------------------------------------------------
create policy "milestones readable via mission visibility" on public.mission_milestones for select
  using (public.can_view_mission(mission_id));
create policy "active members can add milestones" on public.mission_milestones for insert
  with check (public.is_active_mission_member(mission_id));
create policy "creator manages milestones" on public.mission_milestones for update
  using (exists (select 1 from public.missions m where m.id = mission_id and m.creator_id = auth.uid()));
create policy "creator deletes milestones" on public.mission_milestones for delete
  using (exists (select 1 from public.missions m where m.id = mission_id and m.creator_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- mission_needs
-- ---------------------------------------------------------------------------
create policy "needs readable via mission visibility" on public.mission_needs for select
  using (public.can_view_mission(mission_id));
create policy "creator posts needs" on public.mission_needs for insert
  with check (exists (select 1 from public.missions m where m.id = mission_id and m.creator_id = auth.uid()));
create policy "active members can claim or edit needs" on public.mission_needs for update
  using (public.is_active_mission_member(mission_id));
create policy "creator deletes needs" on public.mission_needs for delete
  using (exists (select 1 from public.missions m where m.id = mission_id and m.creator_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- moments
-- ---------------------------------------------------------------------------
create policy "moments readable via mission visibility" on public.moments for select
  using (public.can_view_mission(mission_id));
create policy "active members can post moments" on public.moments for insert
  with check (author_id = auth.uid() and public.is_active_mission_member(mission_id));
create policy "authors delete their own moments" on public.moments for delete using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- mission_media
-- ---------------------------------------------------------------------------
create policy "media readable via mission visibility" on public.mission_media for select
  using (public.can_view_mission(mission_id));
create policy "active members can upload media" on public.mission_media for insert
  with check (uploaded_by = auth.uid() and public.is_active_mission_member(mission_id));
create policy "uploader or creator deletes media" on public.mission_media for delete
  using (uploaded_by = auth.uid() or exists (select 1 from public.missions m where m.id = mission_id and m.creator_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- mission_events: read-only log, visible via mission visibility
-- ---------------------------------------------------------------------------
create policy "events readable via mission visibility" on public.mission_events for select
  using (public.can_view_mission(mission_id));

-- ---------------------------------------------------------------------------
-- live_sessions / hosts / chat / join requests
-- ---------------------------------------------------------------------------
create policy "live sessions readable via mission visibility" on public.live_sessions for select
  using (public.can_view_mission(mission_id));

create policy "live hosts readable via session visibility" on public.live_session_hosts for select
  using (exists (select 1 from public.live_sessions ls where ls.id = live_session_id));

create policy "live chat readable via session visibility" on public.live_chat_messages for select
  using (exists (
    select 1 from public.live_sessions ls where ls.id = live_session_id and public.can_view_mission(ls.mission_id)
  ));
create policy "any viewer who can see the mission can chat" on public.live_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.live_sessions ls where ls.id = live_session_id and public.can_view_mission(ls.mission_id)
    )
    and not exists (
      select 1 from public.blocks b
      join public.live_sessions ls on ls.id = live_session_id
      join public.missions m on m.id = ls.mission_id
      where (b.blocker_id = m.creator_id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = m.creator_id)
    )
  );

create policy "own live join requests or host view" on public.live_join_requests for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.live_session_hosts h where h.live_session_id = live_join_requests.live_session_id and h.user_id = auth.uid())
  );
create policy "viewers can ask to help" on public.live_join_requests for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- relationships: only your own edges are directly queryable (Human Chains'
-- 2nd-degree suggestions go through the SECURITY DEFINER function instead,
-- which is why it isn't gated the same way)
-- ---------------------------------------------------------------------------
create policy "users see their own relationships" on public.relationships for select
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
create policy "users see only their own blocks" on public.blocks for select using (blocker_id = auth.uid());
create policy "users create their own blocks" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "users remove their own blocks" on public.blocks for delete using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- conversations / messages
-- ---------------------------------------------------------------------------
create policy "participants can read their conversations" on public.conversations for select
  using (exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversations.id and cp.user_id = auth.uid()));
create policy "authenticated users can start conversations" on public.conversations for insert with check (auth.uid() is not null);

create policy "fellow participants can read the roster" on public.conversation_participants for select
  using (exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversation_participants.conversation_id and cp.user_id = auth.uid()));
create policy "users add themselves to a conversation" on public.conversation_participants for insert with check (user_id = auth.uid());
create policy "users update their own read marker" on public.conversation_participants for update using (user_id = auth.uid());

create policy "participants can read messages" on public.messages for select
  using (exists (select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()));
create policy "participants can send messages unless blocked" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid())
    and not exists (
      select 1 from public.conversation_participants other
      join public.blocks b on (b.blocker_id = other.user_id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = other.user_id)
      where other.conversation_id = messages.conversation_id and other.user_id <> auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- reputation
-- ---------------------------------------------------------------------------
create policy "users see their own reputation ledger" on public.reputation_events for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "reputation scores are public" on public.reputation_scores for select using (true);

-- ---------------------------------------------------------------------------
-- reports / moderation_actions
-- ---------------------------------------------------------------------------
create policy "reporters and admins can read reports" on public.reports for select
  using (reporter_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "authenticated users can file reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "admins can update reports" on public.reports for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can read moderation actions" on public.moderation_actions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create policy "users see only their own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "users can mark their own notifications read" on public.notifications for update using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- analytics_events
-- ---------------------------------------------------------------------------
create policy "users see their own analytics or admins see all" on public.analytics_events for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "users log their own analytics events" on public.analytics_events for insert with check (user_id = auth.uid());
