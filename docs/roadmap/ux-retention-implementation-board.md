# UX And Retention Implementation Board

## Objective

Refine the existing product into a coherent race-weekend journey, then add retention mechanics that make the private group competition more engaging without creating compulsive or shame-based behavior.

The product should use the rhythm already provided by Formula racing:

1. Join a private group.
2. See the next useful action.
3. Submit a podium prediction before FP1 lock.
4. Return after lock to see how the group predicted.
5. Return after scoring to understand the result and standings movement.
6. Build a season history worth continuing.

## Product Principle

Do not manufacture daily activity.

The useful cadence is race-weekend based. The product should create anticipation, resolution, ownership, and friendly comparison around each Grand Prix while allowing quiet weeks and missed weekends to remain emotionally safe.

## Current UX Review

The current app already has a strong visual foundation:

- a public landing page and public season hub
- a signed-in home page with standings, next race, and recent result
- a member `My Race` dashboard
- a clear podium prediction flow with a mobile submit bar
- transparent season standings with race-by-race score audits
- personal history with scored, missed, and upcoming weekends
- public race recaps, reminder emails, score recap emails, invites, and group administration

The next work should improve orchestration and hierarchy:

- The member dashboard can make a recent missed weekend more prominent than the next useful race context.
- History presents every future weekend as `Open now`, which makes the immediate race action less clear and creates a long noisy page.
- The scored member recap is transparent but still reads like an audit. It needs a faster personal story before the detailed breakdown.
- Standings explain points well but need nearby-rival context and clearer group-first social meaning.
- The prediction screen is visually strong, but the mobile submit bar can obscure content while users review or change their picks.
- Navigation, labels, empty states, loading states, and date presentation should receive a final consistency pass across public, member, and group-admin surfaces.

## Group 1: Must Haves

These changes should ship before trophy cabinets, generated share cards, or more advanced progression systems. They combine current-app refinement with the smallest complete race-weekend retention loop.

### Journey 1: Visitor Receives An Invite And Joins A Group

#### Refine The Entry Journey

**What changes**

- Keep invite links as the main path into private groups.
- Ensure signup, confirmation, and login return the member to the invite claim flow.
- After a successful join, land the user on `My Race`, not a generic page.
- Add one short orientation panel for first-time members.

**Implemented experience**

```text
You joined NL HoofdKantoor

Your first race is Monaco.
Pick the podium before Friday, 13:25.

[ Make my picks ]
```

**Acceptance criteria**

- A new or existing user can claim an invite without losing context.
- The first signed-in page explains the next useful action in one screen.
- Empty states do not expose roadmap or technical language.

### Journey 2: Member Opens The App Before FP1

#### Make The Next Useful Action Dominant

**What changes**

- Make the next race the primary `My Race` hero whenever it is still open.
- Move recent scored or missed weekends into a smaller secondary recap card.
- Replace the current `Race views` sidebar with a lighter season summary on mobile and a compact filter surface on desktop.
- Show prediction state, lock countdown, race time, and group participation in the hero.

**Implemented experience**

```text
MONACO GRAND PRIX
Entries close in 5 days

Your entry: Saved
Group grid: 7 of 10 submitted

[ Edit my picks ]

Latest recap: Canada · No entry submitted
[ Review weekend ]
```

#### Add Group Participation Without Revealing Picks

**What changes**

- Before lock, show only the aggregate number of submitted group entries.
- Do not expose member names or predictions before lock.
- Show a positive completion state when the full group has entered.

**Implemented experience**

```text
7 of 10 entries submitted
Picks stay hidden until the deadline.
```

or:

```text
Full grid. Everyone submitted for Monaco.
```

**Acceptance criteria**

- An open race is always easier to find than a previous missed race.
- The hero has one primary CTA.
- Submission counts do not leak picks or shame missing members.
- Desktop and mobile both communicate the same hierarchy.

### Journey 3: Member Makes Or Edits A Prediction

#### Refine The Prediction Flow

**What changes**

- Keep the existing podium picker and driver board.
- Add a clear back path to `My Race`.
- Make the selected slot state more explicit.
- Keep the sticky submit bar, but reduce its height after it starts covering the lower picker content.
- Show a clear saved state after submit and keep editing available until lock.
- Clarify future weekends: only the next race should use urgent `Predict now` language.

**Implemented experience**

```text
P1 selected
Choose a driver for the winning position.

[ Update prediction ]

Saved. You can edit until Friday, 13:25.
```

**Acceptance criteria**

- A user can understand which podium slot they are editing without scanning the full screen.
- The submit bar does not block the active selection area on common mobile sizes.
- Save confirmation is obvious and does not imply the entry is immutable before lock.
- Future races use calm `View race` or `Plan ahead` labels instead of urgent language.

### Journey 4: Member Returns After Predictions Lock

#### Add The Group Picks Reveal

**What changes**

- Add a private-group reveal section after lock.
- Show each member's submitted podium only after the race entry deadline.
- Add lightweight aggregate insights: most-backed driver, consensus podium, and bold calls.
- Do not expose picks publicly or outside the member's group.

**Implemented experience**

```text
THE GRID IS LOCKED

8 of 10 players backed Norris for the podium.
You are the only player who picked Antonelli for P2.

[ See group picks ]
```

**Acceptance criteria**

- Reveal is unavailable before lock.
- Reveal is scoped to the signed-in member's group.
- Missing entries are presented neutrally.
- Insights are deterministic and explainable from group predictions.

### Journey 5: Member Returns After Scoring

#### Turn The Audit Into A Personal Recap

**What changes**

- Add one short personal recap card before the detailed score audit.
- Show total points, podium read, bonus read, and group standings movement.
- Add one deterministic insight when available: sharp call, near miss, biggest mover, or position held.
- Deep-link recap emails into the signed-in personal recap, with a public race recap as fallback.

**Implemented experience**

```text
MIAMI RECAP

+11 pts · Up 2 positions
You are now P3 in NL HoofdKantoor.

SHARP CALL
Only 2 players predicted Russell on the podium.
You were one of them.

[ View detailed breakdown ]
```

**Acceptance criteria**

- The first recap viewport answers: how did I do, what changed, and what was interesting?
- The detailed score audit remains available for trust.
- Recap copy remains useful when the user missed the weekend or scored zero.

### Journey 6: Member Checks The Standings

#### Make Standings Group-First And Rival-Aware

**What changes**

- Keep private-group standings as the normal member default.
- Keep the global view as a secondary switch.
- Add a small current-user summary with leader gap and the next reachable position.
- Preserve expandable race-by-race transparency, but keep rows collapsed by default on mobile.
- Add the latest movement label when scores have just been published.

**Implemented experience**

```text
NL HOOFDKANTOOR STANDINGS

You are P4 · 6 pts from P3
Within reach: Sofia
Latest race: Up 2 positions
```

**Acceptance criteria**

- A member sees their private group context before global comparison.
- Mobile standings remain scannable without opening a wide audit table automatically.
- Expanded audit detail still explains every scored point.

### Journey 7: Member Looks Back At The Season

#### Turn History Into A Useful Season Archive

**What changes**

- Keep scored and missed weekends in history.
- Replace the long list of every future `Open now` weekend with the next race plus a collapsed future calendar.
- Add race-weekend consistency: entered weekends, missed weekends, and current consecutive run.
- Use recovery language after misses.

**Implemented experience**

```text
YOUR 2026 SEASON

5 weekends entered · 1 missed · 8 pts · 2 exact hits
Current run: 1 consecutive race weekend

You missed Canada, but your season continues.
Your Monaco entry is already saved.
```

**Acceptance criteria**

- History prioritizes the user's season story rather than a long action list.
- A missed weekend does not erase completed progress.
- Future calendar browsing remains available without dominating the page.

### Journey 8: Member Returns Through Email

#### Refine Reminder And Recap Deep Links

**What changes**

- Keep pre-lock reminders only for users who have not entered.
- Mention the group participation count when useful.
- Link directly to the next prediction flow.
- Link score recaps directly to the personal recap.
- Keep user-controlled preferences and unsubscribe behavior.

**Implemented experience**

```text
Monaco picks close Friday at 13:25.
7 of 10 people in NL HoofdKantoor have entered.

[ Make my picks ]
```

and:

```text
Your Miami result is ready.
You scored 11 points and moved up 2 places.

[ See my recap ]
```

**Acceptance criteria**

- Emails provide one clear reason to return and one CTA.
- A submitted member never receives an unnecessary pre-lock reminder.
- Unsubscribe and preference flows remain clear.

### Journey 9: Organizer Checks Group Health

#### Add Lightweight Race-Weekend Group Health

**What changes**

- Show entry coverage for the next race.
- Show reminder timing and delivery health.
- Let organizers copy the invite link quickly.
- Do not expose individual picks before lock.

**Implemented experience**

```text
Monaco coverage
7 of 10 entries submitted
Reminder scheduled for Thursday, 13:25

[ Copy invite link ]
```

**Acceptance criteria**

- An organizer can understand group readiness without platform-admin help.
- Group health does not disclose hidden picks.

### System-Wide Polish Pass

These refinements are part of Group 1 because the new retention loop will only feel intentional if the underlying product feels consistent.

#### Information Hierarchy

- Use one primary CTA per hero or card.
- Keep the next useful action above historical detail.
- Separate member recap, public recap, and score-audit purposes clearly.

#### Copy And State Language

- Standardize `Open`, `Locked`, `Results pending`, `Scored`, `Missed`, and `Cancelled`.
- Reserve urgent language for the next race approaching lock.
- Use recovery language after missed weekends.

#### Navigation

- Add active navigation treatment.
- Keep member navigation focused on `My Race`, `Standings`, `Season`, and `History`.
- Keep admin navigation visually secondary for admins who also participate.

#### Responsive UX

- Verify public home, `My Race`, prediction, standings, history, recap, join, profile, and group-admin surfaces at mobile and desktop sizes.
- Avoid auto-expanded wide audit tables on mobile.
- Ensure sticky CTAs do not obscure the active task.

#### Accessibility And Feedback

- Keep touch targets at least 44px.
- Check heading hierarchy and control labels.
- Add consistent loading, saving, success, empty, and failure states.
- Confirm contrast and focus states for pills, cards, and primary actions.

#### Date And Time Clarity

- Show the member's expected local time consistently.
- Use the same date pattern across dashboard, prediction, history, reminders, and recaps.
- Label lock time separately from race time.

## Group 2: Nice To Haves

These are valuable once Group 1 is shipped and measured.

### Predictor Trophy Cabinet

Add persistent, meaningful trophies:

- `Perfect Podium`
- `Against The Crowd`
- `Consistent Constructor`
- `Comeback Drive`
- `Season Finisher`

Each trophy should open the race or season moment that earned it. Avoid random rewards and trophies for low-value activity.

### Friendly Rivalry Cards

Show opt-in or automatically generated nearby comparisons:

```text
You vs Thomas
You won Miami: 11-7
Season score: Thomas leads 68-64
```

Keep rivalries friendly and based on reachable peers.

### Shareable Race And Season Recaps

Generate privacy-safe cards:

- `I scored 11 points in Miami`
- `Up 2 positions this weekend`
- `My 2026 season: 74 points and 3 exact hits`
- group standings snapshot without private data

Add Open Graph images and a simple share CTA after scoring.

### End-Of-Season Review

Create a personal archive summary:

- best race
- biggest movement
- most successful driver pick
- boldest successful prediction
- entered weekends
- exact hits
- final group position

### Optional Group Challenges

Use short, race-based challenges:

- beat your previous three-race average
- get one exact podium position
- complete the next three race weekends

Challenges should support the core game and should never require meaningless check-ins.

### Group Celebration Moments

Add small moments such as:

```text
Full grid. Everyone submitted for Silverstone.
```

or:

```text
Five players moved positions after Miami.
```

### Group Branding And Recap Exports

For premium organizers:

- group logo or color accent
- exportable standings
- season recap PDF or image
- group archive page

## Implementation Sequence

### Slice 1: Journey Polish

- `My Race` hero hierarchy
- history future-calendar cleanup
- prediction mobile CTA refinement
- active navigation and shared state-copy pass
- mobile and accessibility review

### Slice 2: Group Anticipation

- group entry coverage
- organizer coverage surface
- post-lock private group picks reveal
- deterministic consensus and bold-call insights

### Slice 3: Personal Resolution

- personal recap story card
- group leaderboard movement
- nearby-rival context
- reminder and recap email deep-link refinements

### Slice 4: Season Ownership

- derived race-weekend consistency
- history recovery language
- season archive summary
- analytics for return behavior

### Slice 5: Nice-To-Have Experiments

- trophy cabinet
- rivalry cards
- share cards and Open Graph images
- end-of-season recap
- optional group challenges

## Analytics To Add

Measure whether each slice improves user value:

- invite claim completion
- first prediction completion
- next-race prediction completion before lock
- post-lock reveal views
- recap email open and recap-page visit
- standings visit after scoring
- missed-weekend recovery on the following race
- active groups with at least 70% entry coverage
- share-card use after scoring

## Explicitly Avoid

- daily streak pressure unrelated to race weekends
- random points, loot boxes, or mystery rewards
- public exposure of private-group predictions
- naming and shaming users who missed an entry
- aggressive reminder frequency
- global leaderboards as the only meaningful competition
- visual celebration that makes score transparency harder to understand
