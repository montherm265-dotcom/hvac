-- HUMAN identity domain: who someone verifiably is, how they present, what
-- they can help with, what they've lived through, and what they'll let
-- others see. Skills/interests/lived-experiences are normalized tables, not
-- array/JSON blobs, so matching and moderation can query them directly.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  pronouns text check (char_length(pronouns) <= 40),
  languages text[] not null default '{}', -- ISO 639-1 codes, e.g. {en,pt,es}
  city text,
  region text,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  timezone text, -- IANA tz, e.g. 'Europe/Lisbon'
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create index profiles_country_idx on public.profiles(country_code);
create index profiles_city_trgm_idx on public.profiles using gin (city gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Identity verifications: real trust signals, not decorative badges.
-- Kinds: system-verified (email/phone) and peer-verified (a mission crewmate
-- vouching for a specific skill after working with you) — see
-- verify_peer_skill() in 0008_functions_triggers.sql for the peer path.
-- ---------------------------------------------------------------------------
create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('email', 'phone', 'peer_skill_reference', 'credential')),
  value text not null, -- email address, phone (masked client-side), skill slug, or credential description
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  verifier_id uuid references public.profiles(id), -- null for system-verified
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index identity_verifications_user_idx on public.identity_verifications(user_id);
alter table public.identity_verifications enable row level security;

-- ---------------------------------------------------------------------------
-- Skills & interests taxonomy (open: anyone can add a new one; canonical
-- ones are pre-seeded so most people never need to).
-- ---------------------------------------------------------------------------
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug citext unique not null,
  label text not null,
  category text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.profile_skills (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  mode text not null default 'can_help' check (mode in ('can_help', 'want_to_learn', 'both')),
  proficiency smallint check (proficiency between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (profile_id, skill_id)
);

create index profile_skills_skill_idx on public.profile_skills(skill_id);
alter table public.profile_skills enable row level security;
alter table public.skills enable row level security;

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  slug citext unique not null,
  label text not null,
  category text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

create index profile_interests_interest_idx on public.profile_interests(interest_id);
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;

-- ---------------------------------------------------------------------------
-- Lived experiences: the thing HUMAN is actually built to surface — "who
-- has been through this" — not a bio field, so it can be searched/matched.
-- ---------------------------------------------------------------------------
create table public.lived_experiences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 60),
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 2000),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index lived_experiences_profile_idx on public.lived_experiences(profile_id);
create index lived_experiences_category_idx on public.lived_experiences(category);
alter table public.lived_experiences enable row level security;

-- ---------------------------------------------------------------------------
-- Privacy settings: one row per user, defaults chosen so a new account is
-- discoverable and matchable but keeps precise location hidden by default.
-- ---------------------------------------------------------------------------
create table public.privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'connections', 'private')),
  location_precision text not null default 'city' check (location_precision in ('city', 'hidden')),
  show_lived_experiences boolean not null default true,
  discoverable_in_search boolean not null default true,
  allow_matching boolean not null default true,
  message_permissions text not null default 'anyone' check (message_permissions in ('anyone', 'connections_only')),
  updated_at timestamptz not null default now()
);

alter table public.privacy_settings enable row level security;
