# C2-001 Organizer-Paid Subscriptions

## Objective

Introduce the first revenue path by charging group organizers for premium group features.

## Commercial Intent

Revenue and Trust.

This is the first direct monetization increment.

## User / Admin Value

- Organizers can unlock premium group capabilities.
- Members continue joining without payment friction.
- Platform admins can monitor and enforce paid entitlements.

## Functional Components Embedded

- plan definitions
- group subscription status
- payment checkout
- payment webhook handling
- billing portal link
- entitlement checks around premium features

## User Journey Impact

- Organizer starts a group.
- Organizer sees free vs premium capabilities.
- Organizer upgrades.
- Premium features unlock for that group.
- Organizer can manage billing.

## Scope

- Integrate payment provider.
- Add subscription and entitlement model.
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
- subscription tables
- entitlement helpers
- group admin billing UI

## Data Model Impact

Likely new tables:

- `plans`
- `subscriptions`
- `subscription_events`
- `group_entitlements`

## Test Plan

- Checkout creates a subscription.
- Webhook updates group entitlement.
- Premium features are blocked without entitlement.
- Cancelled subscription downgrades safely.
- Webhook retries are idempotent.

## Dependencies

- C0 trust readiness
- C1 invite/join flow
- pricing decision

## Status

Planned
