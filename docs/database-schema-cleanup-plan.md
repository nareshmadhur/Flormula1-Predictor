# Database Schema Cleanup And Reference Data Plan

Generated from the current migrations and application code on 2026-07-02.

## What Is Safe To Drop Today?

There is no obvious production table that should be dropped immediately. The current app still reads or writes the core schema, tenant/group tables, notification tables, scoring tables, and reference tables. The safer cleanup path is:

1. Add uniqueness and integrity constraints after data cleanup.
2. Retain but age out event/audit rows.
3. Treat caches as rebuildable, not disposable while public pages still read them.
4. Deprecate hard-coded yearly seed scripts in favor of OpenF1-backed sync and audit flows.

## Table Relevance

| table | current role | recommendation |
| --- | --- | --- |
| `profiles` | Auth/profile, tenant, test-mode, notification ownership | Keep. Add audits for confirmed profiles without tenant/preferences. |
| `tenants` | Groups/workspaces | Keep. Core to current product. |
| `constructors`, `drivers`, `circuits` | Reference data for predictions, results, bonus options, imports | Keep. Normalize and constrain, do not cascade-delete production history. |
| `races` | Season calendar and prediction lock source | Keep. Add uniqueness on `season, round` and guarded uniqueness on OpenF1 keys. |
| `bonus_questions`, `bonus_options` | Tenant-scoped game configuration | Keep. Existing triggers are useful; audit older rows against those rules. |
| `predictions`, `prediction_bonus_answers` | User submissions | Keep. Never delete for reference cleanup; migrate/update references instead. |
| `race_results`, `race_bonus_answers` | Official scoring inputs | Keep. Use audit trail and scoring functions. |
| `user_race_scores` | Derived per-race scoring | Keep, but can be rebuilt race-by-race. |
| `leaderboard_cache` | Derived season leaderboard | Keep while app reads it. Candidate for a materialized view or stricter rebuild job later. |
| `group_invites`, `group_invite_acceptances`, `group_requests` | Group growth/admin workflow | Keep. Purge expired/revoked invite rows only after confirming product/reporting needs. |
| `notification_preferences` | User lifecycle settings | Keep. |
| `notification_events` | Delivery log/idempotency | Keep with retention policy. Do not drop while it prevents duplicate reminders/recaps. |
| `notification_platform_settings`, `notification_tenant_settings` | Reminder timing config | Keep. |
| `official_result_audit`, `historic_prediction_audit`, `tenant_bonus_answer_audit` | Admin action audit trails | Keep with archive/retention policy. |

## Simplification Candidates

### 1. Stop using hard-coded season seed scripts for production

The scripts `seed-2024.mjs`, `seed-2026.mjs`, and `seed-official.mjs` encode driver/team assumptions. They are useful as historical local scaffolding, but risky for production because a new season changes driver lineups, constructor names, short codes, headshots, circuits, race order, sprint sessions, and cancellations.

Preferred production path:

```bash
npm run db:audit:reference -- --season 2026
npm run db:audit:reference:openf1 -- --season 2026
node scripts/sync-openf1-reference-data.mjs 2026
```

OpenF1 is already used by the app for schedule and reference sync. Its docs expose session and driver data keyed by `session_key`, including the `latest` concept and driver fields such as `name_acronym` and `team_name`: https://openf1.org/docs/

### 2. Add constraints after cleanup

Recommended migration sequence after audits are clean:

```sql
create unique index if not exists constructors_short_code_unique_idx
on public.constructors (lower(btrim(short_code)));

create unique index if not exists constructors_name_unique_idx
on public.constructors (lower(btrim(name)));

create unique index if not exists drivers_code_unique_idx
on public.drivers (lower(btrim(code)));

create unique index if not exists races_season_round_unique_idx
on public.races (season, round);

create unique index if not exists races_season_external_key_unique_idx
on public.races (season, external_race_key)
where external_race_key is not null;
```

For circuits, prefer a normalized generated key or a carefully reviewed expression index on name/city/country after the audit shows there are no intentional duplicates.

### 3. Retention instead of table drops

Suggested retention defaults:

| data | retention idea |
| --- | --- |
| `notification_events` | Keep current and previous season online; archive/delete older sent/failed rows after export. |
| audit tables | Keep at least two seasons online; export older rows before deletion. |
| expired/revoked `group_invites` | Delete after 90-180 days if not needed for admin support. |
| `leaderboard_cache` | Rebuild, do not manually edit. Delete/rebuild per season when drift is detected. |

### 4. Reference rows should be retired, not deleted

Drivers should usually be marked `active = false` instead of deleted. Constructors/circuits should not be deleted while referenced by drivers, races, bonus options, predictions, or results. Historical rows are part of the game record.

## New Season Change Checklist

Expected annual changes:

- Race calendar: round order, dates, cancellations, sprint weekends, session names/times, circuits.
- Constructors: renames, entrants, short codes, logos/colors.
- Drivers: new rookies, transfers, temporary replacements, three-letter timing acronyms, headshots.
- Product data: tenant bonus questions per race, notification timings, test-mode users/groups.

Recommended flow:

1. Run `npm run db:audit:schema` before schema work.
2. Use the admin schedule OpenF1 import for the new season calendar and missing circuit creation.
3. Run `npm run db:audit:reference -- --season YYYY` after schedule import.
4. Run `npm run db:audit:reference:openf1 -- --season YYYY` once OpenF1 has driver data for a race session.
5. Run `node scripts/sync-openf1-reference-data.mjs YYYY` only after reviewing the audit output.
6. Run the reference audit again and fix any remaining active-driver/team mismatches.
7. Before the first prediction lock, confirm active constructors each have the expected two active drivers.
8. After every scored race, use the audit to detect leaderboard cache drift.

## Added Scripts

### Static schema usage audit

```bash
npm run db:audit:schema
npm run db:audit:schema -- --files
npm run db:audit:schema -- --json
```

This scans migrations and source files. It highlights tables with no direct application references, which is useful for retention/drop discussions but not sufficient by itself to authorize a drop.

### Live reference-data consistency audit

```bash
npm run db:audit:reference -- --season 2026
npm run db:audit:reference:openf1 -- --season 2026
npm run db:audit:reference -- --json --fail-on error
```

This is read-only. It uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` so it can see through RLS and report production inconsistencies.

It checks:

- Duplicate driver codes/names and constructor names/codes.
- Active drivers without constructors.
- Constructors with unexpected active driver counts.
- Race duplicate season/round or external keys.
- FP1-based prediction lock drift.
- Bonus option rows that violate current trigger rules.
- Prediction and result bonus-answer relationship drift.
- Duplicate podium picks/results.
- Upcoming predictions using inactive drivers.
- Confirmed users missing tenant/preference rows.
- Leaderboard cache drift from scored race totals.
- Optional OpenF1 active-driver/team comparison.

## Production-Safe Cleanup Order

1. Backup/export production data.
2. Run both audits and save JSON output.
3. Fix duplicate reference rows by merging references into the canonical row, then retire the duplicate.
4. Recalculate affected race scores and rebuild leaderboard cache.
5. Add uniqueness constraints only after duplicate audits are clean.
6. Add retention jobs for event/audit tables.
7. Remove or archive obsolete manual seed scripts after the OpenF1 path is trusted.
