# Commercialization Master Plan

## Objective

Turn FLORMULA1 Predictor from a polished private predictor into a commercially viable product without creating unnecessary IP, gambling, data, or operational risk.

This is a planning document, not legal advice. Before taking money publicly, especially for contests, prizes, or F1-adjacent branding, get legal review.

## Domain Update

The intended commercial domain is:

- `flormula1.nl`

This makes `Flormula1` the recommended commercial brand direction. Keep the product clearly independent and avoid official F1 branding, imagery, logos, or typography unless permission is obtained.

## Executive Recommendation

Commercialize first as a **private group prediction SaaS**:

- organizers create and manage groups
- members join for free through invite links
- groups compete on points, bragging rights, and season recaps
- the organizer pays for premium group features
- no entry fees, prize pools, or cash payouts in the first commercial version

This path best fits the current architecture because the app already has:

- group/tenant boundaries
- shared race calendar and results
- platform-admin controls
- public discovery pages
- leaderboard transparency
- OpenF1-backed schedule automation

It also avoids the riskiest near-term path: taking entry fees or distributing prizes around sports outcomes.

## Why Not Paid Contests First?

Paid fantasy-style contests can trigger gambling, fantasy sports, prize promotion, and jurisdiction-specific rules.

The U.S. federal UIGEA definition excludes some fantasy/simulation contests from "bet or wager" only if they meet conditions such as fixed prizes announced in advance, skill-based outcomes, and outcomes based on accumulated statistical results across multiple real-world events. State law still matters. Source: [31 U.S.C. § 5362](https://www.law.cornell.edu/uscode/text/31/5362).

So the safer first commercial package is:

- charge organizers for software access
- do not collect entry fees from members
- do not run cash prize pools
- let groups handle informal offline rewards themselves, if they choose

## IP And Brand Readiness

Formula 1's official guidelines are strict. They allow some editorial/fan usage, but Formula 1 marks should not be used to brand games or competitions, logos require written permission, and unofficial sites should be clear that they are not associated with Formula 1. Source: [Formula 1 Guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt).

Before commercial launch:

- do not use official F1 logos, official typography, official artwork, circuit outlines, broadcast stills, or official imagery
- keep race references informational, not brand-defining
- add an unofficial disclaimer to the public footer
- review whether `FLORMULA1` is too close to protected marks for a commercial product
- consider a safer commercial brand like `Flormula`, `Pitwall Picks`, `Podium Pool`, or `Apex Picks`

Recommended near-term decision:

- keep `FLORMULA1 Predictor` during private beta
- rebrand before taking public paid subscriptions unless legal review says the current name is acceptable

## Data Dependency Readiness

The current P2 automation uses OpenF1. OpenF1 is open source and provides historical data for free, but real-time data requires a paid subscription and the project is unofficial. Source: [OpenF1 Docs](https://openf1.org/docs/).

Commercial readiness requires:

- clear OpenF1 credit on `/about`
- fallback manual admin controls for timing and results
- source metadata on imported race/session rows
- no promise of official status
- monitoring for API failures
- a commercial fallback strategy if API access terms change

Best next technical step:

- keep OpenF1 as the primary ingestion source
- keep platform-admin review before publishing results
- add importer health checks and sync logs before launch

## Infrastructure And Cost Readiness

Vercel's Hobby plan is positioned for personal/non-commercial use, while Pro is for professional developers, freelancers, and businesses. Source: [Vercel Pricing](https://vercel.com/pricing/).

Stripe standard online card pricing is currently listed as 2.9% + 30 cents per successful domestic card transaction in the U.S. Source: [Stripe Pricing](https://stripe.com/pricing).

Commercial readiness requires:

- move hosting to a commercial-appropriate plan before paid launch
- add payment-provider webhooks and entitlement checks
- keep spend limits and usage monitoring enabled
- track OpenF1, Supabase, Vercel, email, and payment costs per active group

## Privacy And Email Readiness

Reminder emails are useful, but they need careful consent and preference handling. GDPR requires a lawful basis for personal data processing, and direct marketing has opt-out rights at minimum; consumer marketing generally needs clear opt-in. Source: [GDPR-info email marketing overview](https://gdpr-info.eu/issues/email-marketing/).

Commercial readiness requires:

- reminder preferences per user
- unsubscribe/manage-preferences link in reminder emails
- separate product-critical transactional messages from marketing messages
- privacy policy and terms pages before public paid launch
- data deletion/export handling for user accounts

## Commercialization Paths

### Path A: Organizer-Paid Private Groups

Recommended first path.

Offer group organizers premium features:

- invite links
- group branding
- reminder automation
- season recap
- exportable standings
- admin roster health
- private group-only leaderboard

Why it works:

- aligns with existing tenant/group architecture
- avoids member payment friction
- avoids prize-pool complexity
- sells a clear convenience product to the person organizing the league

Initial pricing experiments:

- free private beta
- founder season pass per group
- monthly organizer subscription
- company/team package for office groups

### Path B: Concierge Office Leagues

Best for early validation.

Manually onboard small workplace/friend groups and charge a simple seasonal setup fee after validation.

Offer:

- setup help
- custom group name
- reminders
- end-of-season recap
- manual admin support

Why it works:

- fastest route to learning willingness to pay
- avoids overbuilding billing too early
- creates testimonials and product feedback

### Path C: Public Fan Growth

Useful after product loops are stable.

Grow via:

- public season pages
- shareable leaderboard snapshots
- race recap cards
- "I scored X points" share images
- SEO around race prediction and recap pages

Why it works:

- already supported by P2 public surfaces
- helps members recruit friends
- drives group creation

### Path D: Paid Contests Or Prize Pools

Do not start here.

Only explore after:

- legal review
- jurisdiction plan
- age/location controls
- terms for contests
- fixed prize rules
- payment compliance review
- brand/IP clearance

This may become a future product, but it is not the best first commercialization route.

## Master Plan Integration

The product vision and linked old/new increments now live in the [Application Vision Roadmap](./application-vision-roadmap.md).

### Completed Foundation

- `P0`: tenant/group foundation and platform safety
- `P1`: tenant product experience and admin usefulness
- `P2.1`: public season/race discovery
- `P2.2`: OpenF1 schedule/timing automation and admin review

### Current Product Direction

Finish P2 around retention:

- pre-lock reminders
- post-score reminders
- reminder preferences
- reminder delivery logs
- basic activation/retention metrics

### Commercialization Track

Add a parallel `C` track after P2 retention starts.

| ID | Title | Value | Suggested Order |
| --- | --- | --- | --- |
| `C0` | Brand, legal, and trust readiness | Prevents avoidable launch risk | 1 |
| `C1` | Invite and join group flow | Removes manual assignment bottleneck | 2 |
| `C2` | Organizer-paid subscription | Creates first revenue path | 3 |
| `C3` | Reminder and recap conversion loops | Improves usage and retention | 4 |
| `C4` | Product analytics and commercial metrics | Measures if commercialization works | 5 |
| `C5` | Public share cards and referral loops | Helps groups grow | 6 |

## To-Be Commercial UX Journeys

### Organizer Journey

1. Visitor sees public standings and season pages.
2. Visitor clicks `Start a group`.
3. Organizer creates a group.
4. Organizer sends invite link.
5. Members join directly without platform-admin assignment.
6. Organizer sees group health: members joined, missing entries, reminder status.
7. Organizer upgrades to premium for reminders, recaps, branding, or larger group limits.

### Member Journey

1. Member receives invite link.
2. Member signs up and confirms email.
3. Member lands inside the group automatically.
4. Member makes predictions before lock.
5. Member gets reminder if they have not entered.
6. Member gets post-score recap.
7. Member shares or discusses standings with the group.

### Platform Admin Journey

1. Admin monitors race schedule sync.
2. Admin resolves missing circuits or timing conflicts.
3. Admin reviews official results and bonus answers.
4. Admin scores race or repairs scores.
5. Admin monitors system health and commercial usage.

## Product Features Needed For Commercialization

### Must Have

- invite links for groups
- automatic group assignment through invites
- reminder preferences
- privacy policy and terms pages
- unofficial F1 disclaimer in footer
- commercial-safe brand decision
- payment-entitlement model for group organizers
- admin usage metrics

### Should Have

- group branding
- season recap cards
- public share cards
- group creation self-serve onboarding
- email delivery logs
- support/contact page
- billing portal

### Could Have Later

- custom scoring rules per group
- workplace/team packages
- sponsor-supported public groups
- paid contests, only after legal review

## Technical Plan

### C1 Invite And Join Flow

Data model:

- `group_invites`
- invite token
- tenant/group id
- created by
- expiry
- max uses
- accepted count

Routes:

- `/groups/start`
- `/join/[token]`
- `/admin/tenant/invites`

Core behavior:

- invite token resolves to group
- signup/login completes membership
- confirmed users get assigned automatically
- platform admins can still manually adjust access

### C2 Billing And Entitlements

Data model:

- `plans`
- `subscriptions`
- `subscription_events`
- `group_entitlements`

Integration:

- Stripe Checkout or Payment Links for early launch
- Stripe webhooks for subscription status
- entitlement checks around premium features

Early pricing model:

- free group tier
- premium group tier
- concierge/team package

### C3 Reminder And Recap Loops

Data model:

- `notification_preferences`
- `notification_events`
- `reminder_jobs`

Triggers:

- race lock minus reminder window
- official results saved
- scores published

Channels:

- email first
- in-app state second

### C4 Analytics

Track:

- public season page views
- signup starts
- email confirmations
- group joins
- first prediction
- reminder clicks
- scored-race return
- organizer upgrade starts
- subscription conversion

## Success Metrics

### Product Activation

- signup confirmation rate
- invite acceptance rate
- first prediction rate
- prediction completion before lock

### Retention

- returning members per race weekend
- reminder click-through
- post-score recap visits
- repeat group activity across races

### Commercial

- groups created
- organizers active
- premium conversion
- monthly recurring revenue
- churn by group
- support burden per paid group

## Recommended Next Sequence

1. Finish P2 reminders and retention hooks.
2. Add footer disclaimer and commercial-safe terms/privacy placeholders.
3. Build invite/join group flow.
4. Run 5-10 private beta groups manually.
5. Add organizer-paid Stripe flow only after beta shows repeated usage.
6. Decide brand/legal posture before public paid launch.
7. Add public share cards and referral loops.

## Launch Gates

Do not publicly commercialize until:

- brand/IP posture is reviewed
- footer disclaimer is live
- terms and privacy pages exist
- invite/join flow works without manual assignment
- reminder preferences exist
- payment entitlements are enforced server-side
- support/contact path exists
- source/API credits are visible
- admin repair workflows are tested

## Source Notes

- Formula 1 official guidelines: [Formula 1 Guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt)
- OpenF1 API docs: [OpenF1 Docs](https://openf1.org/docs/)
- U.S. fantasy contest definition reference: [31 U.S.C. § 5362](https://www.law.cornell.edu/uscode/text/31/5362)
- Vercel commercial plan context: [Vercel Pricing](https://vercel.com/pricing/)
- Stripe payment pricing: [Stripe Pricing](https://stripe.com/pricing)
- GDPR email marketing overview: [GDPR-info](https://gdpr-info.eu/issues/email-marketing/)
