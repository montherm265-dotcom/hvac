-- ASK HUMAN: the primary interaction. A Request is a single, lightweight ask
-- ("I need X") that HUMAN routes to matching people. It can stand alone or
-- escalate into a full Mission once it needs sustained collaboration — see
-- convert_request_to_mission() in 0008_functions_triggers.sql. This is
-- deliberately a separate, lighter object than Missions: not every ask needs
-- milestones and crew.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug citext unique not null,
  label text not null,
  kind text not null default 'both' check (kind in ('request', 'mission', 'both'))
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text not null check (char_length(description) between 10 and 2000),
  category_id uuid references public.categories(id),
  urgency text not null default 'flexible' check (urgency in ('now', 'this_week', 'flexible')),
  location_scope text not null default 'either' check (location_scope in ('local', 'remote', 'either')),
  city text,
  country_code text,
  status text not null default 'open' check (status in ('open', 'matched', 'in_progress', 'closed', 'expired')),
  visibility text not null default 'public' check (visibility in ('public', 'connections')),
  -- FK to missions added in 0003_missions.sql once that table exists.
  converted_to_mission_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index requests_status_idx on public.requests(status);
create index requests_requester_idx on public.requests(requester_id);
create index requests_category_idx on public.requests(category_id);
alter table public.requests enable row level security;

-- ---------------------------------------------------------------------------
-- Matches: the output of HUMAN's routing engine (rule-based today; see
-- run_matching_for_request() and the semantic-match edge function for the
-- upgrade path). One row per (request, candidate) pair.
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  score numeric not null check (score between 0 and 1),
  reason jsonb not null default '{}', -- explanation only, e.g. {"matched_skills": ["carpentry"]}
  algorithm text not null default 'rule_based' check (algorithm in ('rule_based', 'semantic')),
  status text not null default 'suggested' check (status in ('suggested', 'viewed', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (request_id, candidate_id)
);

create index matches_candidate_idx on public.matches(candidate_id, status);
create index matches_request_idx on public.matches(request_id);
alter table public.matches enable row level security;

-- ---------------------------------------------------------------------------
-- Discovery signals: lightweight behavioral signals used to personalize
-- Human Now and Needs You without a full ML pipeline — honest v1
-- personalization, not a black box.
-- ---------------------------------------------------------------------------
create table public.discovery_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'viewed_profile', 'viewed_mission', 'viewed_request', 'searched_term',
    'category_interest', 'joined_mission', 'completed_mission'
  )),
  subject_id uuid,
  subject_type text,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);

create index discovery_signals_user_idx on public.discovery_signals(user_id, created_at desc);
alter table public.discovery_signals enable row level security;

-- ---------------------------------------------------------------------------
-- Rate limits: a real, enforced ceiling on high-frequency write actions
-- (requests, reports, matches responses), not just a UI debounce. Checked
-- via check_rate_limit() inside the relevant RPCs.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  unique (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

insert into public.categories (slug, label, kind) values
  ('community', 'Community', 'both'),
  ('creative', 'Creative', 'both'),
  ('outdoors', 'Outdoors', 'both'),
  ('learning', 'Learning', 'both'),
  ('building', 'Building', 'both'),
  ('sports', 'Sports', 'both'),
  ('volunteering', 'Volunteering', 'both'),
  ('errand', 'Quick errand', 'request'),
  ('advice', 'Advice / lived experience', 'request'),
  ('emotional_support', 'Emotional support', 'request');
