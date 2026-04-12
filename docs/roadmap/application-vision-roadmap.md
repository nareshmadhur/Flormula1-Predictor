# Application Vision Roadmap

## Vision

Build Flormula1 into the easiest way for friends, offices, and fan groups to run a Formula racing prediction league across a season.

The product should feel like:

- standings-first competition
- simple race-weekend predictions
- transparent scoring
- low-effort group administration
- public season context for discovery
- commercial-ready trust, privacy, and compliance

## Domain And Brand Direction

The commercial home is planned around:

- `flormula1.nl`

Recommended brand direction:

- use `Flormula1` as the commercial brand
- keep `FLORMULA1 Predictor` as private-beta/product copy only if needed
- avoid official F1 marks, logos, imagery, and brand styling
- add a public disclaimer before any paid launch

Reasoning:

- Formula 1's own guidelines say Formula 1 marks should not be used to brand games or competitions without permission, and unofficial sites should not imply association. See [Formula 1 Guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt).
- `flormula1.nl` is the owned commercial domain, so the launch path should consistently use `Flormula1` while staying clearly unofficial.
- A `.nl` domain makes the Netherlands/EU compliance story more important, especially privacy, email, commercial identity, and any prize/contest mechanics.

## Product North Star

The app should optimize for this loop:

1. A group organizer starts or manages a group.
2. Members join through an invite.
3. Everyone predicts before FP1 lock.
4. Results are published and scored transparently.
5. The leaderboard becomes the social proof and return hook.
6. Reminders and recaps bring members back for the next race.

## Commercial Intent Levels

Each roadmap component should be labeled with its commercial intent:

| Intent | Meaning |
| --- | --- |
| `Foundation` | Required to make the product safe, reliable, and maintainable. |
| `Engagement` | Improves repeat usage and member value. |
| `Acquisition` | Helps visitors discover, join, or share the product. |
| `Revenue` | Directly supports paid plans, billing, or premium entitlements. |
| `Trust` | Reduces legal, privacy, IP, reliability, or support risk. |

## Roadmap By Phase

| Phase | Increment | Status | Commercial Intent | Outcome |
| --- | --- | --- | --- | --- |
| Foundation | [P0-001 Tenant foundation and safety](./increments/P0-001-tenant-foundation-and-safety.md) | Completed | Foundation, Trust | Safe group boundaries, role model, and platform-admin controls. |
| Product | [P1-001 Tenant product experience](./increments/P1-001-tenant-product-experience.md) | Completed | Foundation, Engagement | Useful member, group-admin, and leaderboard experience. |
| Visibility | [P2-001 Visibility and automation](./increments/P2-001-visibility-and-automation.md) | In progress | Acquisition, Engagement, Trust | Public season journey, OpenF1 schedule import, and upcoming reminder loops. |
| Commercial | [C0-001 Brand and trust readiness](./increments/C0-001-brand-and-trust-readiness.md) | Planned | Trust | Prepare `flormula1.nl`, disclaimers, privacy, terms, and commercial-safe brand posture. |
| Commercial | [C1-001 Invite and join groups](./increments/C1-001-invite-and-join-groups.md) | Planned | Acquisition, Revenue | Remove manual assignment by letting organizers invite members directly. |
| Commercial | [C2-001 Organizer-paid subscriptions](./increments/C2-001-organizer-paid-subscriptions.md) | Planned | Revenue, Trust | Add paid group plans and entitlement checks. |
| Commercial | [C3-001 Reminder and recap loops](./increments/C3-001-reminder-and-recap-loops.md) | Planned | Engagement, Revenue | Improve race-weekend retention and create premium-worthy automation. |
| Commercial | [C4-001 Analytics and commercial metrics](./increments/C4-001-analytics-and-commercial-metrics.md) | Planned | Revenue, Trust | Measure activation, retention, conversion, and operational health. |
| Commercial | [C5-001 Share and referral loops](./increments/C5-001-share-and-referral-loops.md) | Planned | Acquisition, Revenue | Let groups grow through shareable standings, recaps, and invite paths. |

## Product Components And Commercial Intent

| Component | Current Role | Commercial Intent | Notes |
| --- | --- | --- | --- |
| Home page | Public first impression and standings story | Acquisition | Should point visitors toward season, leaderboard, and starting/joining groups. |
| Public season page | Public season chronology | Acquisition | Good SEO/share surface and proof the product is active. |
| Public race hub | Public race context and result surface | Acquisition | Should support race sharing and conversion into signup/group join. |
| Leaderboard | Core competitive surface | Engagement, Acquisition | Public proof and member return hook; expandable scoring transparency is a trust feature. |
| My Season | Member action hub | Engagement | Drives prediction completion and race-weekend behavior. |
| Predict page | Core game action | Engagement | Must stay fast, clear, and confidence-building. |
| History/recaps | Member reward loop | Engagement | Can become premium recap/share material later. |
| Groups and access admin | Manual group/access management | Foundation, Trust | Commercial version should shift manual assignment into invite/join flows. |
| Group admin workspace | Group operator view | Revenue | Future premium surface for organizer-paid plans. |
| Schedule import | Shared canonical timing automation | Trust | Commercially important because wrong lock times damage trust. |
| OpenF1 integration | Race schedule/result data support | Trust | Must be credited and monitored; keep manual fallback. |
| Reminders | Race-weekend return loop | Engagement, Revenue | Strong premium candidate when preferences and logs exist. |
| Billing/entitlements | Not built yet | Revenue, Trust | Required before charging organizers. |
| Analytics | Not built yet | Revenue, Trust | Required to understand activation, churn, and commercial viability. |

## Commercial Strategy

Recommended first commercial model:

- organizer-paid private groups
- free member participation
- no entry fees
- no cash prize pools

Why:

- aligns with the group/tenant architecture
- avoids member payment friction
- reduces gambling/prize-promotion complexity
- makes the buyer clear: the person organizing the pool

Avoid at first:

- paid entry contests
- pooled prize money
- public cash competitions
- official-looking F1 branding

Netherlands-specific caution:

- Dutch authorities regulate games of chance; businesses generally need licences to provide games of chance, and online betting/gambling requires a licence. See [Government.nl games of chance guidance](https://www.government.nl/topics/games-of-chance/rules-for-games-of-chance) and [Business.gov.nl games of chance guidance](https://business.gov.nl/regulations/games-chance/).
- Keep early commercialization as software access, not gambling or prize administration.

## To-Be Commercial Journey

### Organizer

1. Lands on `flormula1.nl`.
2. Sees how group prediction leagues work.
3. Starts a group.
4. Invites members with a link.
5. Watches members join and complete predictions.
6. Uses reminders and recaps to keep the group active.
7. Upgrades for premium group tools.

### Member

1. Receives a group invite.
2. Signs up and confirms email.
3. Lands directly inside the group.
4. Makes a prediction before FP1 lock.
5. Gets reminded before lock if they have not entered.
6. Gets a scored recap after the race.
7. Returns through standings, recap, or the next race reminder.

### Platform Admin

1. Reviews schedule sync and data health.
2. Resolves missing circuits or timing conflicts.
3. Reviews official results and bonus answers.
4. Publishes scores.
5. Monitors groups, usage, billing, and support risk.

## Suggested Execution Sequence

1. Complete P2 reminder and retention foundations.
2. Ship C0 brand/trust readiness around `flormula1.nl`.
3. Ship C1 invite and join groups.
4. Run a private beta with manually selected groups.
5. Ship C4 analytics before billing, so conversion can be measured.
6. Ship C2 organizer-paid subscriptions.
7. Ship C5 share/referral loops.
8. Explore prize/contest mechanics only after legal review.

## Launch Gates For Paid Public Launch

- `flormula1.nl` configured and verified
- commercial-safe brand decision made
- unofficial disclaimer live
- privacy policy and terms live
- invite/join flow working
- reminder preferences working
- OpenF1 credit and fallback documented
- payment entitlements enforced server-side
- organizer support/contact path live
- no paid contests or cash prizes without legal review

## Research References

- [Formula 1 Guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt)
- [OpenF1 Docs](https://openf1.org/docs/)
- [Government.nl games of chance rules](https://www.government.nl/topics/games-of-chance/rules-for-games-of-chance)
- [Business.gov.nl games of chance guidance](https://business.gov.nl/regulations/games-chance/)
- [Business.gov.nl creating a business website](https://business.gov.nl/starting-your-business/first-steps/creating-a-business-website/)
- [SIDN .nl domain information](https://www.sidn.nl/en/)
