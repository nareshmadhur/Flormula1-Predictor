# P2 Visibility And Automation

## Objective

Extend the product beyond the authenticated core through discoverability, canonical data automation, and retention loops.

## User / Admin Value

- Gives the app public surfaces worth sharing and indexing.
- Reduces manual schedule maintenance while increasing repeat usage around race weekends.

## Functional Components Embedded

- public race and result discovery surfaces
- canonical race schedule and timing ingestion
- reminder and follow-up loops around prediction lock and race scoring

## Current Progress

- public `/race/[id]` hub is already shipped as the first outward-facing slice
- sitemap, robots, and root metadata cleanup are already in place
- the broader P2 work is intentionally paused until P1 is complete

## Scope

- complete public result and share surfaces
- automate race schedule and timing updates for the shared source of truth
- add reminder, follow-up, and retention measurement hooks

## Out Of Scope

- changes to the core one-tenant-per-account foundation
- broad social/community expansion beyond the core prediction product

## Technical Components Introduced Or Changed

- public route surfaces and share metadata
- ingestion scripts or services with admin review workflow
- reminder scheduling and retention instrumentation

## Data Model Impact

- may add source metadata and sync timestamps to race records
- may add reminder preferences, notification audit records, or tracking events
- keeps the shared race calendar/results source as the single source of truth

## User Journey Impact

- Public visitor journey: can discover races and results without being forced into auth first.
- Member journey: gets better discovery before signup and better reminder/follow-up loops after joining.
- Admin journey: spends less time on manual timing entry and more time on review and exceptions.

## Test Plan

- verify public pages render and link correctly without auth
- verify imported schedules match expected race timing data
- verify reminder events and opt-in behavior work as intended
- verify public growth work does not regress tenant or admin safety

## Status

Parked after first slice
