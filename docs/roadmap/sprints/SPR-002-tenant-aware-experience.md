# SPR-002 Tenant-Aware Experience

## Goal

Make the current dashboard, leaderboard, history, and admin flows tenant-aware while keeping one tenant per account.

## Status

- Tenant setup screen added for admins.
- Account access is now managed in-app with role, admin scope, and tenant controls in one place.
- Tenant context now appears in the dashboard, leaderboard, history, and navbar.
- Leaderboard now supports tenant and global views with smarter defaults for members, platform admins, and unassigned users.
- Unassigned users now get an explicit fallback banner instead of silently operating in ambiguous context.
- Private competition pages now enforce tenant assignment before access.
- Platform admin boundaries are now enforced for shared race control, scoring, tenant management, and reference-data routes.

## Increment Links

- [P0 Tenant foundation and safety](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/increments/P0-001-tenant-foundation-and-safety.md>)
- [P1 Tenant product experience](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/increments/P1-001-tenant-product-experience.md>)
