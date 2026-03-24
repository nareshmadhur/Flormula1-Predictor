# FLO-RMULA 1 Predictions App

A modern, high-performance web application designed for predicting Formula 1 race outcomes. Users can predict the podium finishers (P1, P2, P3) and answer custom bonus questions for each race. Admins can manage the season schedule, score predictions, and maintain the underlying grid roster.

## Functional Requirements (v1)

- **User Authentication**: Secure signup and login using Supabase Auth.
- **Race Schedule Management**: Admins can add upcoming races, configure circuits, and set lock times.
- **Dynamic Prediction Forms**: Users can select drivers for the podium from the active grid, with client-side validation preventing duplicate selections.
- **Bonus Questions**: Admins can attach multiple-choice bonus questions to specific races (e.g., "Fastest Lap?", "First DNF?").
- **Lock-Time Enforcement**: Predictions automatically lock 5 minutes prior to the formation lap.
- **Scoring Engine**: Points are awarded logically for exact podium positions (3pts) and correct drivers in the wrong position (1pt), plus any configured bonus points.
- **Global Leaderboard**: Cumulative tracking of user scores across the season.
- **Reference Data Administration**: Dedicated "Grid Data" dashboard for managing active drivers, constructors, and circuits dynamically without writing SQL.

## Technical Architecture

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS + generic utilities (lucide-react for icons)
- **Database**: Supabase PostgreSQL (Relational schema with 13 customized tables)
- **Deployment**: Next.js optimized for Vercel/Node deployments.
- **Data Fetching**: SSR-first with Next.js Server Actions and `revalidatePath` for immediate caching invalidation upon mutations.

## Database Schema Highlights
The database strictly utilizes PostgreSQL Row Level Security (RLS) to ensure that users can only modify their own predictions, while allowing public reads on leaderboards and reference data.

Core Tables:
- `profiles`
- `races`
- `predictions` & `prediction_bonus_answers`
- `drivers`, `constructors`, `circuits`
- `bonus_questions` & `bonus_options`
- `user_race_scores` & `leaderboard_cache`

## Local Development

1. Create a `.env.local` file based on your Supabase credentials.
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

2. Run the development server
```bash
npm install
npm run dev
```

3. Seed Reference Data
```bash
node scripts/seed-official.mjs
```
