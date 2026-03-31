import { createClient } from '@/utils/supabase/server'
import { Flag, Timer, ChevronRight, Trophy } from 'lucide-react'
import { format, isPast } from 'date-fns'
import { getCurrentSeason } from '@/utils/season'
import { getProfileDisplayName } from '@/utils/profile-name'
import { PendingLink } from '@/components/ui/pending-link'

export const revalidate = 0

type LeaderboardEntry = {
  user_id: string
  total_points: number
  profiles?: {
    display_name?: string | null
    email?: string | null
  } | Array<{
    display_name?: string | null
    email?: string | null
  }> | null
}

function getLeaderboardProfile(entry: LeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

export default async function HomePage() {
  const supabase = await createClient()
  const currentSeason = await getCurrentSeason(supabase)

  // Get next upcoming race (time-based filtering)
  const { data: upcomingRaces } = await supabase
    .from('races')
    .select(`*, circuits(name, country, emoji)`)
    .eq('season', currentSeason)
    .gte('race_start_at', new Date().toISOString()) // Only future races
    .neq('status', 'cancelled') // Exclude cancelled races
    .order('race_start_at', { ascending: true })
    .limit(1)

  const nextRace = upcomingRaces?.[0]

  // Get top 5 leaderboard
  const { data: leaderboard } = await supabase
    .from('leaderboard_cache')
    .select(`user_id, total_points, profiles(display_name, email)`)
    .eq('season', currentSeason)
    .order('total_points', { ascending: false })
    .limit(5)

  // Get latest scored race
  const { data: latestScoredRaces } = await supabase
    .from('races')
    .select(`*, circuits(name, country, emoji)`)
    .eq('season', currentSeason)
    .eq('status', 'scored')
    .order('race_start_at', { ascending: false })
    .limit(1)

  const latestScored = latestScoredRaces?.[0]

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Hero / Next Race Section */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 to-black border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Flag className="w-64 h-64" />
        </div>
        
        <div className="relative p-8 md:p-12">
          {nextRace ? (
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center space-x-2 bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-sm border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="font-bold tracking-wider uppercase">Next Race</span>
              </div>
              
              <div>
                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter mb-2">
                  {nextRace.race_name}
                </h1>
                <p className="text-xl text-slate-300 flex items-center space-x-2">
                  <span className="text-2xl">{nextRace.circuits?.emoji}</span>
                  <span>{nextRace.circuits?.name}, {nextRace.circuits?.country}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                  <div className="text-sm text-slate-400 mb-1 flex items-center"><Timer className="w-4 h-4 mr-1" /> Race Starts</div>
                  <div className="font-bold text-lg">{format(new Date(nextRace.race_start_at), 'PPP p')}</div>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                  <div className="text-sm text-slate-400 mb-1">Predictions Lock (FP1 - 5m)</div>
                  <div className={"font-bold text-lg " + (isPast(new Date(nextRace.prediction_lock_at)) ? "text-red-500" : "text-amber-400")}>
                    {format(new Date(nextRace.prediction_lock_at), 'PPP p')}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-3">
                  <PendingLink href={`/race/${nextRace.id}`} className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:scale-105">
                    Open Race Hub <ChevronRight className="ml-2 w-6 h-6" />
                  </PendingLink>
                  <PendingLink href={`/race/${nextRace.id}/predict`} className="inline-flex items-center justify-center gap-1.5 border border-white/10 bg-black/30 hover:bg-white/10 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all">
                    Go To Prediction Page
                  </PendingLink>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
              <Flag className="w-16 h-16 text-slate-600 mx-auto" />
              <h1 className="text-3xl font-black italic tracking-tighter">SEASON COMPLETE</h1>
              <p className="text-slate-400">There are no upcoming races scheduled right now.</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Top 5 Leaderboard purely visual */}
        <section className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-black italic tracking-tight flex items-center">
              <Trophy className="w-6 h-6 mr-2 text-yellow-500" /> TOP 5
            </h2>
            <PendingLink href="/leaderboard" className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors">
              View full leaderboard &rarr;
            </PendingLink>
          </div>
          
          <div className="space-y-3">
            {(!leaderboard || leaderboard.length === 0) ? (
              <p className="text-slate-500 text-sm italic">No points scored yet.</p>
            ) : (
              leaderboard.map((entry: LeaderboardEntry, index: number) => {
                const profile = getLeaderboardProfile(entry)

                return (
                  <div key={entry.user_id} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 text-center font-bold text-slate-400">{index + 1}</span>
                    <span className="font-semibold">
                      {getProfileDisplayName(profile?.display_name, profile?.email)}
                    </span>
                  </div>
                  <span className="font-black text-red-500">{entry.total_points} pt</span>
                </div>
                )
              })
            )}
          </div>
        </section>

        {/* Latest Scored Race */}
        <section className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-black italic tracking-tight mb-6 text-slate-300">
            LATEST RESULTS
          </h2>
          
          {latestScored ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-red-500 font-bold uppercase tracking-wider mb-1">Round {latestScored.round}</div>
                <div className="text-xl font-bold">{latestScored.race_name}</div>
                <div className="text-slate-400 text-sm">{latestScored.circuits?.name} {latestScored.circuits?.emoji}</div>
              </div>
              
              <PendingLink href={`/race/${latestScored.id}`} className="inline-flex items-center gap-1 mt-4 text-slate-300 hover:text-white underline decoration-slate-600 underline-offset-4">
                View Race Details
              </PendingLink>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 italic border border-dashed border-white/10 rounded-xl">
              No races have been scored yet.
            </div>
          )}
        </section>
      </div>

    </div>
  )
}
