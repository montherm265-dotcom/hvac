-- Live Missions: the livestream belongs to the Mission, not the other way
-- around. This schema models mission-side state (who's hosting, who's
-- watching, who asked to help, chat, recording metadata) and stays
-- deliberately provider-agnostic — the `provider`/`provider_*_id` columns
-- are populated by a Supabase Edge Function that calls the real streaming
-- API (Cloudflare Stream) with server-side secrets. See
-- supabase/functions/create-live-stream and README "Activating the backend".

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  provider text not null default 'cloudflare_stream' check (provider in ('cloudflare_stream')),
  provider_stream_id text, -- Cloudflare "live input" UID, set by the edge function
  provider_playback_id text, -- Cloudflare playback UID for the HLS/DASH URL
  playback_url text, -- fully-formed HLS URL the client can play directly, no provider knowledge needed
  status text not null default 'idle' check (status in ('idle', 'live', 'ended', 'failed')),
  started_at timestamptz,
  ended_at timestamptz,
  recording_url text,
  created_at timestamptz not null default now()
);

create index live_sessions_mission_idx on public.live_sessions(mission_id, created_at desc);
create unique index live_sessions_one_active_per_mission on public.live_sessions(mission_id) where status in ('idle', 'live');
alter table public.live_sessions enable row level security;

create table public.live_session_hosts (
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'host' check (role in ('host', 'co_host')),
  primary key (live_session_id, user_id)
);

alter table public.live_session_hosts enable row level security;

create table public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index live_chat_session_idx on public.live_chat_messages(live_session_id, created_at);
alter table public.live_chat_messages enable row level security;

-- "I CAN HELP" — a viewer asking to become a participant mid-broadcast.
create table public.live_join_requests (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (live_session_id, user_id)
);

alter table public.live_join_requests enable row level security;
