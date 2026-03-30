# P0 Tenant Foundation And Safety

## Objective

Finish the minimum tenant architecture and safety boundaries required before expanding the product experience.

## User / Admin Value

- Makes tenant membership a real product rule instead of a future idea.
- Protects users from ambiguous competition context and protects admins from unsafe global access patterns.

## Functional Components Embedded

- one-tenant-per-account foundation
- tenant-gated private competition routes
- tenant-aware dashboard, history, and signed-in leaderboard behavior
- platform-admin-only access to shared race control, scoring, tenant management, and reference data

## Scope

- tenant schema and profile assignment support
- tenant lookup helpers and private-route guards
- tenant assignment screen for platform admins
- platform admin access helpers and navigation gating
- scoped admin read policies and follow-up migration support

## Out Of Scope

- richer tenant management UX
- tenant branding or tenant-level customization
- deeper scored-race explanations
- public growth loops and automation

## Technical Components Introduced Or Changed

- `supabase/migrations/0003_tenant_foundation.sql`
- `supabase/migrations/0004_platform_admin_scope.sql`
- `utils/tenant.ts`
- `utils/admin-access.ts`
- tenant-aware authenticated routes
- platform-admin protected admin routes and actions

## Data Model Impact

- adds `tenants`
- adds `profiles.tenant_id`
- introduces platform-admin policy helpers and scoped admin-read behavior

## User Journey Impact

- Assigned member journey: signs in and sees tenant-scoped competition pages instead of global ambiguity.
- Unassigned member journey: is clearly blocked from private competition flows until tenant assignment is complete.
- Platform admin journey: can safely manage shared races, scoring, tenant setup, and reference data.
- Tenant-assigned admin journey: no longer inherits unsafe platform-wide control by default.

## Test Plan

- run `0003_tenant_foundation.sql`
- run `0004_platform_admin_scope.sql`
- verify tenant creation and tenant assignment still work
- verify unassigned users are blocked from private competition pages
- verify only platform admins can access shared admin surfaces
- run `npm run build`

## Status

Completed
