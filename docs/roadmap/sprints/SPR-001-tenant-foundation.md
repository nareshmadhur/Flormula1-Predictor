# SPR-001 Tenant Foundation

## Goal

Start the multi-tenant architecture without breaking the current shared-season experience.

## Increment Links

- [P0 Tenant foundation and safety](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/increments/P0-001-tenant-foundation-and-safety.md>)

## Status

- Navigation and season-state UX already improved.
- Tenant schema foundation is now the active build item.

## Components Introduced In This Sprint

- `docs/roadmap/*`
- `utils/tenant.ts`
- `supabase/migrations/0003_tenant_foundation.sql`

## Test Focus

- migration applies cleanly
- existing auth/profile flows still work
- existing season dashboard and race views remain unaffected
- touched TypeScript files lint clean
