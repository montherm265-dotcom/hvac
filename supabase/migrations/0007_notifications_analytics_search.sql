-- Notifications (per-user, ephemeral, markable-read — distinct from the
-- permanent mission_events log), the analytics event stream that lets HUMAN
-- measure whether it's creating real human connections, and full-text
-- search over profiles/missions/requests.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'mission_joined', 'mission_state_changed', 'new_moment', 'new_message',
    'milestone_completed', 'need_matched', 'request_matched', 'match_accepted',
    'introduction_made', 'live_mission_started', 'live_join_requested',
    'relationship_formed', 'peer_skill_verified'
  )),
  payload jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id) where not is_read;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- Analytics events: the product's own instrumentation. Append-only; written
-- via log_analytics_event() so user_id is always the authenticated caller
-- (or null for pre-auth events like landing-page views).
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  event_type text not null check (event_type in (
    'request_created', 'request_matched', 'match_accepted', 'introduction_made',
    'mission_created', 'mission_joined', 'milestone_completed', 'viewer_became_participant',
    'help_given', 'help_received', 'meaningful_conversation_started', 'person_discovered',
    'relationship_formed', 'search_performed', 'profile_viewed'
  )),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index analytics_events_type_idx on public.analytics_events(event_type, created_at desc);
create index analytics_events_user_idx on public.analytics_events(user_id, created_at desc);
alter table public.analytics_events enable row level security;

-- ---------------------------------------------------------------------------
-- Full-text search
-- ---------------------------------------------------------------------------
alter table public.profiles add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(bio, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'C')
  ) stored;
create index profiles_search_idx on public.profiles using gin (search_vector);

alter table public.missions add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index missions_search_idx on public.missions using gin (search_vector);

alter table public.requests add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index requests_search_idx on public.requests using gin (search_vector);
