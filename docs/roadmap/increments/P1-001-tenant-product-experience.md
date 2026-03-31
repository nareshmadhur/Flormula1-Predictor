# P1 Tenant Product Experience

## Objective

Turn the safe tenant foundation into a clearer, more useful tenant product for both members and admins.

## User / Admin Value

- Makes tenant competition feel intentional and understandable instead of merely enforced.
- Gives admins practical tenant operations instead of bare-minimum setup screens.

## Functional Components Embedded

- improved tenant admin workspace
- in-app account access management for role, admin scope, and tenant assignment
- platform-admin participation without losing platform rights
- clearer tenant identity across dashboard, history, leaderboard, and admin screens
- tenant/global leaderboard switching with sensible defaults
- safer predictor-name fallbacks when legacy profiles have no display name
- richer scored-race and missed-race explanations
- stronger season storytelling inside the tenant context

## Scope

- better tenant admin tools and summaries
- tenant metadata and tenant context polish in core screens
- leaderboard scope controls for tenant versus global comparison
- allow platform admins to join the competition without collapsing platform access
- richer score explanation, missed-race states, and leaderboard movement context

## Out Of Scope

- public SEO/share growth surfaces
- automated schedule ingestion
- reminders and retention systems

## Technical Components Introduced Or Changed

- tenant admin forms and overview cards
- profile access action and access-management UI
- profile name fallback helper and backfill support
- tenant-aware UI framing and copy updates
- leaderboard view-state handling for tenant/global comparison
- richer race result explanation blocks and derived comparison helpers

## Data Model Impact

- admin-scope constraint relaxed so platform admins may also carry tenant membership
- may add derived score-delta or comparison fields
- no major change to shared race-source ownership

## User Journey Impact

- Member journey: always knows which tenant competition they are in and understands race outcomes more clearly.
- Comparison journey: can move between tenant standings and the full cross-tenant leaderboard without losing context.
- Post-race journey: can see not only points, but why points changed and what was missed.
- Admin journey: can manage tenant setup and account access from a more usable operational surface without being forced out of the competition.

## Test Plan

- verify tenant metadata and account access updates save correctly
- verify leaderboard defaults and tenant/global switching behave correctly for members, platform admins, and unassigned users
- verify platform admins can join a tenant and still access both race control and prediction flows
- verify legacy profiles no longer render as `Anonymous` in core leaderboard surfaces
- verify tenant context is visible and consistent across authenticated screens
- verify scored-race explanations and missed-race states are accurate
- verify no regression in tenant guards or platform-admin boundaries

## Status

Completed
