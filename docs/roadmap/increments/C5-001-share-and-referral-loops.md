# C5-001 Share And Referral Loops

## Objective

Turn standings, recaps, and invite links into natural acquisition loops.

## Commercial Intent

Acquisition and Revenue.

Sharing should help groups grow and help organizers discover the paid product.

## User / Admin Value

- Members can share fun results without exposing private data.
- Organizers can invite members more easily.
- Public pages become stronger growth surfaces.

## Functional Components Embedded

- shareable leaderboard snapshot
- shareable race recap
- invite-backed share links
- Open Graph image generation
- referral attribution for group creation

## User Journey Impact

- Member sees a scored recap.
- Member shares a result or standings snapshot.
- Visitor lands on a public page.
- Visitor joins an existing group or starts a new group.

## Scope

- Add share images for public race/leaderboard views.
- Add share CTAs after scoring.
- Connect share flows to invite/join where relevant.
- Track referral source at a basic level.

## Out Of Scope

- paid ads
- influencer tooling
- public prize competitions

## Technical Components Introduced Or Changed

- Open Graph image routes
- share URL helpers
- referral token handling
- public landing copy updates

## Data Model Impact

Potential additions:

- referral/source fields on invite or group creation records
- share event tracking through C4

## Test Plan

- Shared links render correct public metadata.
- Private group data is not leaked.
- Invite-backed share links assign users correctly.
- Referral attribution works at least at source/invite level.

## Dependencies

- C1 invite/join flow
- C4 analytics

## Status

Planned
