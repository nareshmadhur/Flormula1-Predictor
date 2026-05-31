# C0-001 Brand And Trust Readiness

## Objective

Prepare the product for public commercial use under a cleared brand and domain without avoidable brand, legal, privacy, or trust risk.

## Commercial Intent

Trust.

This increment does not directly create revenue, but it is a gate before charging publicly.

## User / Admin Value

- Visitors understand the product is independent and unofficial.
- Organizers can trust the product enough to invite their groups.
- Platform admins have a safer launch posture before paid use.

## Functional Components Embedded

- private-beta `flormula1.nl` migration plan
- commercial brand and domain clearance checkpoint
- unofficial motorsport/F1 disclaimer
- privacy policy page
- terms page
- source/data credits
- support/contact path
- brand-name review checkpoint
- test mode isolation for safe onboarding and invite testing

## Current Progress

- footer disclaimer and trust links added
- `/privacy`, `/terms`, and `/contact` pages added as draft trust surfaces
- sitemap coverage added for trust pages
- test group/user flags added so validation data can stay out of public/global standings

## User Journey Impact

- A visitor lands on the cleared commercial domain and understands what the product is.
- A visitor can see trust/legal links in the footer.
- An organizer has enough confidence to start or request a group.

## Scope

- Add footer trust links.
- Add privacy and terms placeholder pages.
- Add unofficial disclaimer.
- Document OpenF1 and data-source dependencies.
- Prepare the commercial brand shortlist, clearance step, and deployment/domain migration checklist.
- Add a lightweight test-mode foundation before broader invite testing.

## Out Of Scope

- Paid billing.
- Prize pools.
- Legal approval itself.
- Full rebrand implementation unless chosen.

## Technical Components Introduced Or Changed

- public trust pages
- footer/navigation links
- site URL/domain environment configuration
- metadata and environment updates for the cleared commercial domain
- `is_test` flags for groups and profiles
- admin test-mode toggles
- public/global leaderboard filtering for test data

## Data Model Impact

- `tenants.is_test`
- `profiles.is_test`

## Test Plan

- Verify footer links are visible on public pages.
- Verify metadata and canonical URLs use the cleared commercial domain.
- Verify disclaimers are present before paid launch.
- Verify test groups/accounts are hidden from public/global standings but still work inside their own group.

## Dependencies

- commercial brand decision
- access to DNS/domain configuration for the cleared commercial domain

## Status

In progress
