# C4-001 Analytics And Commercial Metrics

## Objective

Measure activation, retention, conversion, and operational health so commercialization decisions are data-informed.

## Commercial Intent

Revenue and Trust.

Analytics should answer whether the product is commercially viable and where users drop off.

## User / Admin Value

- Platform admins can see whether groups are active.
- Product decisions can be based on real behavior.
- Commercial experiments can be measured safely.

## Functional Components Embedded

- event taxonomy
- signup and invite funnel tracking
- prediction completion metrics
- reminder click metrics
- group activity dashboard
- commercial conversion metrics

## User Journey Impact

Mostly admin-facing.

Indirectly improves user experience by revealing:

- confusing onboarding steps
- missed prediction bottlenecks
- low-retention race weekends

## Scope

- Define event taxonomy.
- Track critical product events.
- Add admin metrics dashboard.
- Keep analytics privacy-conscious.

## Out Of Scope

- invasive tracking
- third-party ad targeting
- full BI warehouse

## Technical Components Introduced Or Changed

- event capture helper
- event storage or analytics provider integration
- dashboard query layer
- admin reporting surface

## Data Model Impact

Likely new table if stored internally:

- `product_events`

Important fields:

- `event_name`
- `user_id`
- `tenant_id`
- `race_id`
- `metadata`
- `created_at`

## Test Plan

- Events fire once per intended action.
- No sensitive data is stored in metadata.
- Admin metrics match underlying database counts.
- Opt-out/privacy behavior is documented.

## Dependencies

- C0 privacy/trust readiness
- C1 invite/join flow for full funnel tracking

## Status

Planned
