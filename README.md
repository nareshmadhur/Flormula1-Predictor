# FLO-RMULA 1 Predictions App

FLO-RMULA 1 is a Formula 1 prediction pool built with Next.js and Supabase. Users submit podium picks and bonus answers for each race, follow their season from a dashboard, and review scored results once admins publish official outcomes.

## Current Product

### User Experience
- Season dashboard for the current season
- Podium prediction flow for open races
- Locked, completed, and scored race states with read-only summaries
- Bonus question support per race
- Personal history page
- Tenant and global leaderboard views with smart defaults
- Email/password authentication with Supabase

### Admin Experience
- In-app admin navigation for platform admins
- Tenant and account access management in `/admin/tenants`
- Race calendar management
- Bonus question management per race
- Official result entry
- Score calculation and leaderboard cache rebuild
- Driver reference data management
- Manual maintenance action for race status updates

## Product Shape

The app currently uses one shared F1 race calendar and one shared official result source.

Current tenant model:
- one tenant per account
- shared global race calendar and shared official results
- tenant-specific competition context layered on top of shared race data
- global leaderboard = all tenants combined
- tenant leaderboard = only users in that tenant
- signed-in tenant members default to their tenant leaderboard, while platform admins and unassigned users default to global
- platform admins can also belong to a tenant and participate in the pool; platform rights come from `admin_scope`, not from being unassigned

This keeps scheduling, timing, and future automated race-data ingestion centralized instead of duplicating race operations per tenant.

## Roles And Permissions

- `user`
  Can access the private competition experience only after tenant assignment.
- `admin` with `admin_scope = platform`
  Acts as the platform admin. Can manage tenants, shared race data, scoring, and reference data for the whole product, while still optionally belonging to a tenant as a participant.
- `admin` with `admin_scope = tenant`
  Is explicitly scoped away from platform-wide control. The role is assignable from the admin access workspace now, with tenant-scoped tooling expanding in `P1`.

In practical terms:
- race schedules, bonus questions, official results, and scoring inputs are entered once by a platform admin and reused by all tenants
- tenant membership only affects competition context and leaderboard slicing
- missing public display names fall back to a sanitized email-derived predictor name instead of `Anonymous`
- app-visible profiles are treated as confirmed users only; pending email confirmations should not appear in admin account lists

Detailed execution tracking lives in [docs/roadmap/README.md](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/README.md>).

## Core Journeys

### User
1. Sign up and confirm email.
2. Get assigned to a tenant by a platform admin.
3. Sign in and land on the season dashboard at `/predictions`.
4. Open the next race and submit podium picks plus bonus answers.
5. Revisit the same race after lock to see the submitted entry.
6. Return after scoring to see official results and point breakdown.
7. Use `/leaderboard` to switch between tenant and global standings when comparison matters.

### Platform Admin
1. Sign in as a platform admin.
2. Open `Admin` from the main navigation.
3. Open `/admin/tenants` to create tenants and set each account's role, admin scope, and tenant assignment.
4. Create or update races for the season.
5. Add bonus questions and official answers.
6. Save official podium results.
7. Calculate scores and refresh the leaderboard.

## Technical Overview

- Framework: Next.js 16 App Router
- UI: React 19, TypeScript, Tailwind CSS 4
- Backend: Supabase Auth + Postgres + RLS
- Data writes: Server Actions
- Session handling: Supabase SSR helpers
- Caching: `revalidatePath` and `leaderboard_cache`

Important app areas:
- `app/page.tsx`: public homepage
- `app/predictions/page.tsx`: authenticated season dashboard
- `app/race/[id]/predict/page.tsx`: race lifecycle view
- `app/leaderboard/page.tsx`: current-season leaderboard
- `app/admin/*`: admin workflows
- `app/actions/*`: server actions
- `supabase/migrations/*`: schema and data model

## Data Model

Core tables:
- `profiles`
- `races`
- `predictions`
- `prediction_bonus_answers`
- `bonus_questions`
- `bonus_options`
- `race_results`
- `race_bonus_answers`
- `user_race_scores`
- `leaderboard_cache`
- `drivers`
- `constructors`
- `circuits`

Notes:
- predictions are unique per `user_id + race_id`
- scores are unique per `user_id + race_id`
- leaderboard cache is unique per `season + user_id`
- shared race data is tenant-agnostic
- tenant membership lives on `profiles.tenant_id`
- explicit admin scope lives on `profiles.admin_scope`

## Scoring

- 3 points for an exact podium position
- 1 point for the right driver in the wrong podium position
- bonus points come from the question configuration
- prediction lock defaults to 5 minutes before FP1, with race start only used as a temporary fallback for legacy races missing FP1

## Setup

### Prerequisites
- Node.js 18+
- npm
- Supabase project

### Install
```bash
npm install
```

### Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Seed Data

Example:

```bash
node scripts/seed-official.mjs
```

### Run
```bash
npm run dev
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Known Gaps

- No automated test suite is currently included.
- Some repo-wide lint issues still exist outside the most recently updated files.
- Race schedule and results are still managed manually.
- Tenant-scoped admin tooling is still early; platform admins currently have the fuller operational workspace.

## Roadmap

### Step 1
- completed foundation and safety work for tenants, private competition guards, and platform-admin boundaries

### Step 2
- improve tenant product experience
- expand tenant-facing admin tools and clearer tenant/global context
- deepen scored-race explanations and post-race usability

### Step 3
- public result pages and visibility mechanics
- automated schedule and timing ingestion
- reminder and retention loops
