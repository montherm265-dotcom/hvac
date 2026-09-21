-- HUMAN core schema
-- Missions are the central object: real-world things people are doing, not posts.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  city text,
  country text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Missions
-- ---------------------------------------------------------------------------
create type public.mission_state as enum (
  'idea', 'planning', 'active', 'progress', 'near_completion', 'completed', 'paused', 'archived'
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  category text not null,
  city text,
  country text,
  cover_image_url text,
  state public.mission_state not null default 'idea',
  crew_limit integer check (crew_limit is null or crew_limit > 0),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index missions_state_idx on public.missions(state);
create index missions_city_idx on public.missions(city);
create index missions_created_at_idx on public.missions(created_at desc);

alter table public.missions enable row level security;

create policy "public missions are readable by anyone"
  on public.missions for select
  using (not is_private or creator_id = auth.uid() or exists (
    select 1 from public.mission_participants mp
    where mp.mission_id = missions.id and mp.user_id = auth.uid()
  ));

create policy "authenticated users can create missions"
  on public.missions for insert
  with check (creator_id = auth.uid());

create policy "creators can update their missions"
  on public.missions for update
  using (creator_id = auth.uid());

create policy "creators can delete their missions"
  on public.missions for delete
  using (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Mission participants (crew)
-- ---------------------------------------------------------------------------
create type public.participant_role as enum ('creator', 'crew', 'supporter');

create table public.mission_participants (
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.participant_role not null default 'crew',
  joined_at timestamptz not null default now(),
  primary key (mission_id, user_id)
);

alter table public.mission_participants enable row level security;

create policy "participants readable by anyone who can read the mission"
  on public.mission_participants for select
  using (exists (
    select 1 from public.missions m where m.id = mission_id
  ));

create policy "users can join missions themselves"
  on public.mission_participants for insert
  with check (user_id = auth.uid());

create policy "users can leave missions themselves"
  on public.mission_participants for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Mission milestones
-- ---------------------------------------------------------------------------
create table public.mission_milestones (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text,
  position integer not null default 0,
  is_done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index mission_milestones_mission_idx on public.mission_milestones(mission_id, position);

alter table public.mission_milestones enable row level security;

create policy "milestones readable by anyone who can read the mission"
  on public.mission_milestones for select
  using (exists (select 1 from public.missions m where m.id = mission_id));

create policy "creator or crew can manage milestones"
  on public.mission_milestones for all
  using (exists (
    select 1 from public.missions m
    where m.id = mission_id and (
      m.creator_id = auth.uid()
      or exists (select 1 from public.mission_participants mp where mp.mission_id = m.id and mp.user_id = auth.uid())
    )
  ));

-- ---------------------------------------------------------------------------
-- Mission needs ("Needs You")
-- ---------------------------------------------------------------------------
create table public.mission_needs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  skill_needed text not null,
  description text,
  is_filled boolean not null default false,
  created_at timestamptz not null default now()
);

create index mission_needs_skill_idx on public.mission_needs(skill_needed);
create index mission_needs_open_idx on public.mission_needs(is_filled) where not is_filled;

alter table public.mission_needs enable row level security;

create policy "needs readable by anyone who can read the mission"
  on public.mission_needs for select
  using (exists (select 1 from public.missions m where m.id = mission_id));

create policy "creator manages needs"
  on public.mission_needs for all
  using (exists (select 1 from public.missions m where m.id = mission_id and m.creator_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Moments (progress updates attached to a mission)
-- ---------------------------------------------------------------------------
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  image_url text,
  created_at timestamptz not null default now()
);

create index moments_mission_idx on public.moments(mission_id, created_at desc);

alter table public.moments enable row level security;

create policy "moments readable by anyone who can read the mission"
  on public.moments for select
  using (exists (select 1 from public.missions m where m.id = mission_id));

create policy "participants can post moments"
  on public.moments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.missions m
      where m.id = mission_id and (
        m.creator_id = auth.uid()
        or exists (select 1 from public.mission_participants mp where mp.mission_id = m.id and mp.user_id = auth.uid())
      )
    )
  );

create policy "authors can delete their own moments"
  on public.moments for delete
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Blocks (trust & safety)
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "users see only their own blocks"
  on public.blocks for select
  using (blocker_id = auth.uid());

create policy "users can create their own blocks"
  on public.blocks for insert
  with check (blocker_id = auth.uid());

create policy "users can remove their own blocks"
  on public.blocks for delete
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports (trust & safety)
-- ---------------------------------------------------------------------------
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'mission', 'moment', 'message')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index reports_status_idx on public.reports(status);

alter table public.reports enable row level security;

create policy "reporters can see their own reports"
  on public.reports for select
  using (reporter_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ));

create policy "authenticated users can file reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());

create policy "admins can update reports"
  on public.reports for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------------------------------------------------------------------------
-- Conversations & messages
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.missions(id) on delete cascade,
  is_group boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages(conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "participants can read their conversations"
  on public.conversations for select
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  ));

create policy "authenticated users can create conversations"
  on public.conversations for insert
  with check (true);

create policy "participants readable by fellow participants"
  on public.conversation_participants for select
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id and cp.user_id = auth.uid()
  ));

create policy "users can add themselves to a conversation"
  on public.conversation_participants for insert
  with check (user_id = auth.uid());

create policy "users can update their own read marker"
  on public.conversation_participants for update
  using (user_id = auth.uid());

create policy "participants can read messages in their conversations"
  on public.messages for select
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  ));

create policy "participants can send messages, unless blocked"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.conversation_participants other
      join public.blocks b on (b.blocker_id = other.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = other.user_id)
      where other.conversation_id = messages.conversation_id and other.user_id <> auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'mission_joined', 'mission_state_changed', 'new_moment', 'new_message',
    'milestone_completed', 'need_matched', 'mission_comment'
  )),
  payload jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id) where not is_read;

alter table public.notifications enable row level security;

create policy "users see only their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "users can mark their own notifications read"
  on public.notifications for update
  using (user_id = auth.uid());

create policy "system can insert notifications for any user"
  on public.notifications for insert
  with check (true);
