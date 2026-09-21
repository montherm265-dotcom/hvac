-- Missions: sustained, structured collaboration. Bigger and longer-running
-- than a Request — real states, crew, milestones, a real activity timeline
-- (mission_events, distinct from user-facing notifications), and media.

create type public.mission_state as enum (
  'idea', 'planning', 'active', 'progress', 'near_completion', 'completed', 'paused', 'archived'
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  category_id uuid references public.categories(id),
  city text,
  country_code text,
  cover_image_url text,
  state public.mission_state not null default 'idea',
  crew_limit integer check (crew_limit is null or crew_limit > 0),
  visibility text not null default 'public' check (visibility in ('public', 'connections', 'private')),
  origin_request_id uuid references public.requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.requests
  add constraint requests_converted_to_mission_fk
  foreign key (converted_to_mission_id) references public.missions(id);

create index missions_state_idx on public.missions(state);
create index missions_city_idx on public.missions(city);
create index missions_created_at_idx on public.missions(created_at desc);
alter table public.missions enable row level security;

-- ---------------------------------------------------------------------------
-- Mission members (renamed from a plain "participants" list: creator, crew
-- who signed up to do the work, supporters who are just following along,
-- and co_host, which grants live-session hosting rights).
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('creator', 'crew', 'supporter', 'co_host');

create table public.mission_members (
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'crew',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (mission_id, user_id)
);

alter table public.mission_members enable row level security;

-- ---------------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------------
create table public.mission_milestones (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text,
  position integer not null default 0,
  is_done boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index mission_milestones_mission_idx on public.mission_milestones(mission_id, position);
alter table public.mission_milestones enable row level security;

-- ---------------------------------------------------------------------------
-- Needs ("Needs You" open asks attached to a mission, matched against
-- profile_skills by get_matching_needs() in 0008_functions_triggers.sql)
-- ---------------------------------------------------------------------------
create table public.mission_needs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  skill_id uuid references public.skills(id),
  description text,
  is_filled boolean not null default false,
  filled_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index mission_needs_skill_idx on public.mission_needs(skill_id);
create index mission_needs_open_idx on public.mission_needs(mission_id) where not is_filled;
alter table public.mission_needs enable row level security;

-- ---------------------------------------------------------------------------
-- Moments: the narrative timeline crew post themselves (distinct from the
-- system-generated mission_events audit log below).
-- ---------------------------------------------------------------------------
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  milestone_id uuid references public.mission_milestones(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index moments_mission_idx on public.moments(mission_id, created_at desc);
alter table public.moments enable row level security;

-- ---------------------------------------------------------------------------
-- Mission media: actual uploaded assets (Supabase Storage paths), optionally
-- attached to a Moment. Kept separate from moments so live-session
-- recordings and bulk photo drops don't need a fake text body.
-- ---------------------------------------------------------------------------
create table public.mission_media (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  moment_id uuid references public.moments(id),
  storage_path text not null, -- path within the 'mission-media' Storage bucket
  media_type text not null check (media_type in ('image', 'video', 'audio')),
  width integer,
  height integer,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index mission_media_mission_idx on public.mission_media(mission_id, created_at desc);
alter table public.mission_media enable row level security;

-- ---------------------------------------------------------------------------
-- Mission events: the immutable, system-written activity log a Mission
-- Timeline UI reads from. Distinct from `notifications` (per-user, ephemeral,
-- can be marked read) — this is the permanent record of what happened.
-- ---------------------------------------------------------------------------
create table public.mission_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in (
    'created', 'state_changed', 'member_joined', 'member_left', 'milestone_added',
    'milestone_completed', 'moment_posted', 'media_added', 'live_started', 'live_ended',
    'need_posted', 'need_filled'
  )),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index mission_events_mission_idx on public.mission_events(mission_id, created_at);
alter table public.mission_events enable row level security;
