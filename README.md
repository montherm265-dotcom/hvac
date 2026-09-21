# HUMAN

**Find the humans who make life happen.**

HUMAN is a social network built around **Missions** and **Requests**, not posts. Ask Human for
something you need; HUMAN routes it to real people who can help, based on skills, interests, lived
experience, and location — not a search box. A Mission is the heavier, sustained version: real crew,
milestones, a live activity timeline, and (when configured) a livestream that belongs to the Mission,
not the other way around.

This is a real, security-tested foundation — not a demo. Every table has row-level security with
allow/deny paths actually tested against a local Postgres instance (see "Testing the backend locally"),
every button either works or says plainly what infrastructure it's waiting on, and nothing fakes AI,
livestreaming, users, or metrics.

## Stack

React + Vite + Tailwind CSS. Supabase (Postgres + Auth + Realtime + RLS) for the backend, plus two
Supabase Edge Functions that call real third-party APIs server-side (Anthropic for semantic matching,
Cloudflare Stream for live video) so those API keys never reach the client.

## The database, by domain

All schema lives in `supabase/migrations/`, applied in numeric order. Every important relationship is
an explicit table with real foreign keys — no JSON blobs standing in for structure.

| File | Domain |
|---|---|
| `0001_identity.sql` | profiles, identity_verifications, skills/interests taxonomy + join tables, lived_experiences, privacy_settings |
| `0002_requests_and_matching.sql` | categories, requests (Ask Human), matches, discovery_signals, rate_limits |
| `0003_missions.sql` | missions, mission_members, mission_milestones, mission_needs, moments, mission_media, mission_events |
| `0004_live_missions.sql` | live_sessions, live_session_hosts, live_chat_messages, live_join_requests |
| `0005_social_graph.sql` | relationships (Human Chains), blocks, conversations, messages |
| `0006_trust_safety_reputation.sql` | reputation_events, reputation_scores, reports, moderation_actions |
| `0007_notifications_analytics_search.sql` | notifications, analytics_events, full-text search columns |
| `0008_functions_triggers.sql` | every RPC and trigger: rate limiting, the mission state machine, Human Chains formation, the matching engine, reputation rollups, live-session lifecycle, moderation |
| `0009_policies.sql` | RLS policies for every table |
| `0010_seed_taxonomy.sql` | bootstrap skills/interests so onboarding isn't a blank box |

## Core features (real, working against this schema)

- **Identity** — email/password auth, unique username, profile with pronouns/languages/city/timezone.
- **Onboarding** — a real multi-step flow collecting location, skills, interests, and (optional) lived
  experience right after signup, not a skippable modal that leads nowhere.
- **Ask Human** — post a request; HUMAN runs its matching engine against it immediately.
- **Human matching/routing** — `run_matching_for_request()` scores every eligible candidate by real
  skill/interest/lived-experience/location overlap (deterministic, explainable). The `semantic-match`
  Edge Function is the upgrade path — same output shape, scored by an LLM — see "Activating the backend".
- **Needs You** — two real sources merged: requests HUMAN routed to you as a candidate, and open Mission
  needs matching your listed skills.
- **Missions** — idea → planning → active → progress → near_completion → completed/paused/archived,
  enforced by a Postgres trigger (`enforce_mission_state_transition`) so it can't be bypassed by a raw
  client update, not just inside the RPC.
- **Mission participation & discovery** — join/leave (block-aware, crew-limit-aware), Human Now feed
  (active + live missions + open nearby requests), category filters.
- **Live Mission architecture** — `live_sessions` et al. model viewers (Realtime Presence, real today),
  chat, "I CAN HELP" join requests, co-hosts, and recording metadata. Actual ingest/encode/deliver comes
  from Cloudflare Stream via `create-live-stream`/`end-live-stream` Edge Functions.
- **Mission timelines** — `mission_events` is a permanent, system-written audit log per mission, shown
  as the Timeline tab — distinct from user-facing, dismissable `notifications`.
- **Human Moments** — progress updates crew post on a mission.
- **Human Memory** — a real personal timeline built from reputation_events/relationships/moments, not a
  separate "memories" feature with its own fake data.
- **Human Chains** — your real connection graph (formed by joining missions or accepting matches, never
  "following"), plus real 2-hop suggestions via `get_human_chain_suggestions()`.
- **Messaging & notifications** — 1:1 conversations (block- and privacy-aware), Realtime-backed, with a
  full notification-type taxonomy.
- **Search** — Postgres full-text search (`tsvector` + GIN) across people, Missions, and requests.
- **Reputation & trust** — an append-only ledger (`reputation_events`) rolled up into `reputation_scores`;
  displayed as real counts ("14 missions completed"), never a star rating. Peer skill verification
  (`verify_peer_skill()`) is only grantable by someone who actually completed a mission with you.
- **Privacy controls** — profile visibility (public/connections/private), location precision, message
  permissions, matching opt-out, search opt-out — enforced in RLS and in the matching/messaging RPCs, not
  just hidden in the UI.
- **Reporting / blocking / admin moderation** — report any user/mission/moment/message/request/live
  session; `/admin` is a real moderation queue (admin-only via RLS + RPC check) that calls
  `apply_moderation_action()`, which actually suspends/bans/removes content, not just logs an opinion.
- **Personalization / discovery loops** — `discovery_signals` + reputation/relationships drive Human Now
  ordering and Needs You; the retention design is deliberately about real discovery ("someone needs
  exactly you"), not engagement-bait mechanics.
- **Mobile-first, i18n-ready** — every page is responsive by default (Tailwind); `src/i18n/` is real
  locale infrastructure (see "Internationalization" below), not a hardcoded-English placeholder.

## What's honestly not built yet

Per the brief: no fake AI, no fake livestreaming, no fake scale. These need real infrastructure this
build doesn't provision, with the abstraction point already built:

- **Semantic matching** — `supabase/functions/semantic-match` calls Anthropic's API for real once
  `ANTHROPIC_API_KEY` is set as an Edge Function secret. Until then it returns HTTP 501 and the frontend
  (`src/lib/matchingProvider.js`) falls back to the rule-based RPC and never claims the AI ran.
- **Live video** — `supabase/functions/create-live-stream`/`end-live-stream` call Cloudflare Stream's
  real API once `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_STREAM_API_TOKEN`/`CLOUDFLARE_STREAM_CUSTOMER_CODE`
  are set. Until then, "Go Live" says exactly that and does nothing else — no fake player, no fake
  viewer count on a stream that isn't real.
- **Automated moderation** — reports route to a human-reviewed admin queue only; no text/image
  classification model is wired in.
- **Global multi-region infrastructure** — single Supabase region + static frontend host today. Real
  multi-region read replicas/edge compute is an infra decision for when there's real usage.
- **Monetization** — intentionally last in the stated priority order, and not built.

## Activating the backend

The Supabase org backing this account is at its **2-project free-tier limit**, so no live project could
be provisioned this session. Everything is written and ready:

1. Create a Supabase project (or free a slot on the existing org).
2. Apply the migrations in `supabase/migrations/` in numeric order.
3. Copy `.env.example` to `.env.local` with the project's URL and anon/publishable key.
4. Deploy the Edge Functions: `supabase functions deploy semantic-match create-live-stream
   end-live-stream`.
5. Set secrets as needed: `supabase secrets set ANTHROPIC_API_KEY=... CLOUDFLARE_ACCOUNT_ID=...
   CLOUDFLARE_STREAM_API_TOKEN=... CLOUDFLARE_STREAM_CUSTOMER_CODE=...`. Each feature degrades honestly
   (never fakes) if its secrets are absent.
6. `npm install && npm run dev`.

## Testing the backend locally

`supabase/tests/run_rls_tests.sh` applies every migration to a **local** Postgres database (via a small
shim in `supabase/tests/00_supabase_shim.sql` that reproduces `auth.uid()` and the `anon`/`authenticated`
roles) and runs `supabase/tests/rls_test.sql` — real ALLOWED and DENIED access checks (anon reading a
public vs. private mission, one user trying to update another's mission, a non-admin calling an
admin-only RPC, blocked users failing to message each other, a raw UPDATE failing to skip the mission
state machine, etc.), not just "does the SQL parse." Requires a local `postgres` superuser:

```bash
sudo service postgresql start   # if not already running
supabase/tests/run_rls_tests.sh
```

This is how the schema in this repo was actually verified — running it caught and fixed four real bugs
during development (a rate-limit crash on service-role writes, a privacy-setting bypass in the profiles
policy caused by RLS-within-RLS, a `missions`/`mission_members` policy recursion cycle, and an enum cast
error), never applied to a live Supabase project.

## Internationalization

`src/i18n/` is real infrastructure: locale detection/switching, a translation function with a safe
English fallback (a partially-translated locale never renders blank), and locale-aware date/number
formatting via `Intl`. `en` is fully translated; `es` intentionally covers a meaningful subset (nav,
Home, Auth) to prove the mechanism end-to-end — expanding coverage or adding a locale is additive, not a
rewrite.

## Analytics events tracked

`log_analytics_event()` (called from `src/lib/analytics.js`'s `track()`) records: `request_created`,
`request_matched`, `match_accepted`, `introduction_made`, `mission_created`, `mission_joined`,
`milestone_completed`, `viewer_became_participant`, `help_given`, `help_received`,
`meaningful_conversation_started`, `person_discovered`, `relationship_formed`, `search_performed`,
`profile_viewed` — the actual question being measured is whether HUMAN is creating real human
connections and outcomes, not engagement.

## Local setup

```bash
npm install
cp .env.example .env.local  # fill in once a Supabase project exists
npm run dev
```

## Deploying

`npm run build` produces a static `dist/` — deployable to any static host. The Supabase project and Edge
Functions must be live with their env vars/secrets set.
