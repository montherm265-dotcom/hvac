-- Reputation as an append-only ledger of real actions, rolled up into a
-- per-user summary — never a star rating. Trust & safety as a real
-- report -> admin review -> moderation action pipeline.

create table public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'mission_completed', 'milestone_completed', 'help_given', 'help_received',
    'peer_skill_verified', 'report_upheld_against', 'no_show'
  )),
  weight numeric not null,
  mission_id uuid references public.missions(id),
  request_id uuid references public.requests(id),
  created_at timestamptz not null default now()
);

create index reputation_events_user_idx on public.reputation_events(user_id, created_at desc);
alter table public.reputation_events enable row level security;

create table public.reputation_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  missions_completed integer not null default 0,
  help_given_count integer not null default 0,
  help_received_count integer not null default 0,
  reliability_score numeric not null default 50 check (reliability_score between 0 and 100),
  last_computed_at timestamptz not null default now()
);

alter table public.reputation_scores enable row level security;

-- ---------------------------------------------------------------------------
-- Reports & moderation actions
-- ---------------------------------------------------------------------------
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'mission', 'moment', 'message', 'request', 'live_session')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index reports_status_idx on public.reports(status);
alter table public.reports enable row level security;

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id),
  target_type text not null,
  target_id uuid not null,
  action text not null check (action in ('warn', 'remove_content', 'suspend_user', 'ban_user', 'dismiss')),
  actor_id uuid not null references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index moderation_actions_target_idx on public.moderation_actions(target_type, target_id);
alter table public.moderation_actions enable row level security;
