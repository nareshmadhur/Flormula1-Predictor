# C1-001 Invite And Join Groups

## Objective

Remove manual platform-admin assignment as the primary onboarding path by letting organizers invite members directly into a group.

## Commercial Intent

Acquisition and Revenue.

This is the key feature that makes self-serve group growth possible.

## User / Admin Value

- Organizers can grow groups without platform-admin help.
- Members can join the right group immediately after signup/login.
- Platform admins spend less time assigning users manually.

## Functional Components Embedded

- group invite links
- invite landing page
- join-after-login/signup flow
- invite management in group admin workspace
- invite expiry and usage limits

## User Journey Impact

- Organizer creates invite.
- Organizer shares invite link.
- Member opens link, signs up, confirms email, and lands in the group.
- Existing member can accept an invite after login.

## Scope

- Create invite token model.
- Add `/join/[token]`.
- Auto-assign confirmed users to a group through invite.
- Add group admin invite management.
- Keep platform-admin manual access management as fallback.

## Out Of Scope

- Billing.
- Public group directories.
- Prize/pool mechanics.

## Technical Components Introduced Or Changed

- `group_invites` table
- `group_invite_acceptances` table
- invite token generation and validation
- auth callback join continuation
- group admin invite UI
- access assignment server action updates
- `/join/[token]` landing and accept flow

## Data Model Impact

Likely new table:

- `group_invites`

Potential fields:

- `id`
- `tenant_id`
- `token_hash`
- `created_by`
- `expires_at`
- `max_uses`
- `accepted_count`
- `revoked_at`
- `created_at`

## Test Plan

- New user joins through invite after email confirmation.
- Existing user joins through invite after login.
- Expired/revoked invite fails safely.
- Platform admin can still manually adjust group membership.
- Tenant/group admin cannot invite into another group.
- Invite links can be created and revoked from the group admin workspace.
- A user already in the target group sees a safe “already joined” state.

## Dependencies

- P0/P1 role and group model
- auth confirmation flow

## Status

In progress.

Implementation started with migration `0013_group_invites.sql`, group invite admin UI, `/join/[token]`, and auth continuation through `next`.
