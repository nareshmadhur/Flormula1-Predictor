# SPR-005 Retention And Group Growth

## Goal

Connect race-weekend return loops with self-serve group growth.

## Status

In progress.

## Increment Links

- [P2 Visibility and automation](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/increments/P2-001-visibility-and-automation.md>)
- [C1 Invite and join groups](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/increments/C1-001-invite-and-join-groups.md>)
- [C3 Reminder and recap loops](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/increments/C3-001-reminder-and-recap-loops.md>)

## User Journey

- Organizer creates an invite link.
- Member joins a group without platform-admin assignment.
- Member gets reminded before prediction lock.
- Member returns after scoring through a recap link.

## Commercial Intent

Acquisition, Engagement, and Revenue.

This sprint creates the practical loop needed before organizer-paid plans.

## Components To Build / Test

- group invite model
- `/join/[token]`
- group-admin invite management
- signup/login continuation back to invite links
- reminder preferences
- reminder delivery logs
- post-score recap deep links

## Test Plan

- New user joins through invite after email confirmation.
- Existing user joins through invite after login.
- Expired/revoked invite fails safely.
- Group admin creates an invite, copies the generated link, and revokes it.
- Reminder preferences can be changed.
- Pre-lock reminder skips users who already submitted.
- Post-score reminder deep-links to the correct recap.
