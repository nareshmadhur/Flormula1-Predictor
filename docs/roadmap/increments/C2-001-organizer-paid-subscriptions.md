# C2-001 Organizer-Paid Season Passes

## Objective

Introduce the first revenue path by charging group organizers once per season for premium group features.

## Commercial Intent

Revenue and Trust.

This is the first direct monetization increment.

## User / Admin Value

- Organizers can unlock premium group capabilities.
- Members continue joining without payment friction.
- Platform admins can monitor and enforce paid entitlements.

## Functional Components Embedded

- plan definitions
- group season-pass status
- one-time payment checkout
- payment webhook handling
- billing history and status
- entitlement checks around premium features

## User Journey Impact

- Organizer starts a group.
- Organizer sees free vs premium capabilities.
- Organizer upgrades.
- Premium features unlock for that group.
- Organizer can view the active season pass and payment status.

## Scope

- Integrate payment provider.
- Add season-pass and entitlement model.
- Gate premium features server-side.
- Add billing status to group admin workspace.

## Out Of Scope

- Member entry fees.
- Prize pools.
- Paid contests.
- Complex enterprise sales tooling.

## Technical Components Introduced Or Changed

- payment provider integration
- webhook route
- season-pass payment tables
- entitlement helpers
- group admin billing UI

## Data Model Impact

Likely new tables:

- `plans`
- `group_season_passes`
- `payment_events`
- `group_entitlements`

## Test Plan

- Checkout creates a paid season pass.
- Webhook updates the season-scoped group entitlement.
- Premium features are blocked without entitlement.
- A refunded or expired pass downgrades safely.
- Webhook retries are idempotent.

## Dependencies

- C0 trust readiness
- C1 invite/join flow
- pricing baseline: `€10` founder season pass, then `€25` standard season pass

## Status

Planned
