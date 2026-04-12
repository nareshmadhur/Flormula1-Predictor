# C3-001 Reminder And Recap Loops

## Objective

Create race-weekend return loops through pre-lock reminders and post-score recaps.

## Commercial Intent

Engagement and Revenue.

This improves retention and can become part of paid group value.

## User / Admin Value

- Members are less likely to miss prediction deadlines.
- Members return after scoring to see what changed.
- Organizers get more active groups.

## Functional Components Embedded

- reminder preferences
- pre-lock reminder job
- post-score recap notification
- notification event log
- deep links into race prediction and recap pages

## User Journey Impact

- Member gets reminded before FP1 lock if they have not entered.
- Member clicks directly into the race prediction page.
- After scoring, member gets a recap link.
- Member sees score, correctness, and leaderboard movement.

## Scope

- Email reminders first.
- Preference management.
- Delivery logging.
- Admin visibility into reminder health.

## Out Of Scope

- SMS/push notifications.
- Marketing campaigns.
- Complex notification segmentation.

## Technical Components Introduced Or Changed

- scheduled jobs or automation runner
- email provider integration
- notification preferences
- notification logs
- reminder deep-link generation

## Data Model Impact

Likely new tables:

- `notification_preferences`
- `notification_events`
- `reminder_jobs`

## Test Plan

- Reminder only sends to opted-in users.
- Reminder skips users who already submitted.
- Post-score recap sends after scoring.
- Unsubscribe/preferences link works.
- Delivery failures are logged.

## Dependencies

- P2 canonical timing
- C0 privacy/trust readiness

## Status

Planned
