# HUMAN

**Find the humans who make life happen.**

HUMAN is a social network built around **Missions**, not posts. A Mission is a real thing someone
is trying to make happen — rebuild a fence, run a study group, organize a cleanup — that moves through
real states (`idea → planning → active → progress → near_completion → completed`, with `paused`/`archived`
off-ramps) and pulls in the humans who help it happen: crew, milestones, and Moments (progress updates),
instead of likes and followers.

This is a real V1, not a prototype: real Postgres schema with row-level security, a real auth flow,
real state machine enforced server-side, real matching, messaging, and notifications. Nothing in the UI
fakes data or claims to work when it doesn't — see **What's honestly not built yet** below for the pieces
that need infrastructure this build doesn't provision.

## Stack

React + Vite + Tailwind CSS on the frontend, Supabase (Postgres + Auth + Realtime + RLS) on the backend.
No LLM, livestreaming, or geolocation SDKs are wired in — see the roadmap.

## Core features (real, working against the schema below)

- **Identity** — email/password auth, unique username, profile (bio, city, skills, interests).
- **Ask Human** — create a Mission (title, description, category, city, crew limit, private/public).
- **Missions** — server-enforced state machine (`set_mission_state` RPC validates legal transitions and
  that only the creator can move it), join/leave crew (`join_mission`/`leave_mission`, block-aware,
  crew-limit-aware), milestones with completion tracking.
- **Human Now** — the home feed: active/in-progress public missions, filterable by category.
- **Needs You** — rule-based matching (`get_matching_needs` RPC) between a mission's open needs and your
  profile's skills. This is deliberately simple string matching today, not semantic matching — see roadmap.
- **Moments** — progress updates posted by mission crew, visible to anyone who can see the mission.
- **Messaging** — 1:1 direct messages (auto-created via `get_or_create_direct_conversation`, blocked users
  can't open a thread) with Postgres Realtime for live delivery.
- **Notifications** — server-side triggers fan out notifications on join, state change, new moment, new
  message, and milestone completion; the navbar bell subscribes to them live.
- **Trust & safety** — block a user (also blocks messaging and mission joins both directions), report a
  user/mission/moment/message into a `reports` table gated to admins, `/safety` page.
- **Location privacy** — city-level text field only, entered by the user; no device geolocation is read.

## Activating the backend

This account's Supabase org is already at its **2-project free-tier limit**, so no live project could be
provisioned for HUMAN in this session — `mcp__Supabase__create_project` fails with:

> "reached their maximum limits for the number of active free projects... (2 project limit)"

Everything is written and ready to go the moment a project slot is free (pause/delete an unused project,
or upgrade the org plan):

1. Create a Supabase project.
2. Apply the migrations in order: `supabase/migrations/0001_human_schema.sql`, then
   `supabase/migrations/0002_human_functions.sql` (via `supabase db push`, the SQL editor, or the
   `apply_migration` MCP tool).
3. Copy `.env.example` to `.env.local` and fill in the project's URL and anon/publishable key.
4. `npm install && npm run dev`.

Until then, the UI runs against a placeholder Supabase URL and every data call fails gracefully with a
visible "no live backend" notice (`src/components/BackendNotice.jsx`) rather than silently faking data.

## What's honestly not built yet

Per the brief: don't fake infrastructure that doesn't exist. These need real third-party accounts/services
before they're real, in the priority order given (core experience → trust & safety → reliability → speed →
user value → network effects → scalability → monetization):

- **Semantic matching ("Human Serendipity Engine")** — `get_matching_needs` does exact/case-insensitive
  skill-string matching. Real semantic matching (skills, phrasing, intent) needs an embeddings/LLM API key
  (e.g. OpenAI, or Anthropic for text understanding) wired into an edge function — the RPC is structured so
  swapping in a `pgvector` similarity query or an edge-function call is a drop-in replacement.
- **Live Missions (livestreaming)** — needs a real streaming provider (Mux, LiveKit, Cloudflare Stream).
  No fake "Go Live" button exists in this build.
- **Automated moderation** — reports currently route to a human-reviewed queue only; there's no
  automated text/image classification, which needs a moderation API and/or human moderator staffing.
- **Global multi-region infrastructure** — this is a single Supabase region + static frontend host. Real
  multi-region read replicas / edge compute is an infra decision to make once there's real usage, not
  something to fake in a V1.
- **Monetization** — intentionally last in the priority order given, and not built.

## Adding a new page

1. Add the file to `src/pages/`.
2. Register the route in `src/App.jsx`, wrapping it in `<RequireAuth>` if it needs a signed-in user.

## Local setup

```bash
npm install
cp .env.example .env.local  # fill in once a Supabase project exists
npm run dev
```

## Deploying

`npm run build` produces a static `dist/` — deployable to any static host. The Supabase project must be
live and its URL/key set as build-time env vars.
