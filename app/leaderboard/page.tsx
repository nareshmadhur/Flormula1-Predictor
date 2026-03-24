import { createClient } from '@/utils/supabase/server'
import { Trophy, Medal, Star } from 'lucide-react'

export const revalidate = 0 // always fetch fresh data for leaderboard

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // Fetch from the leaderboard cache or calculate. For v1, let's fetch from the cache.
  // Wait, we need to join with profiles to get display_name.
  
  const { data: leaderboard, error } = await supabase
    .from('leaderboard_cache')
    .select(`
      user_id,
      total_points,
      exact_hits,
      races_scored,
      profiles ( display_name )
    `)
    .order('total_points', { ascending: false })
    .order('exact_hits', { ascending: false })

  if (error) {
    console.error('Error fetching leaderboard:', error)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center space-x-4">
        <Trophy className="w-10 h-10 text-yellow-500" />
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter">GLOBAL LEADERBOARD</h1>
          <p className="text-slate-400">See who is predicting the podium best.</p>
        </div>
      </div>

      <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 border-b border-white/5">
                <th className="p-4 font-semibold text-slate-300 w-16 text-center">Rank</th>
                <th className="p-4 font-semibold text-slate-300">Predictor</th>
                <th className="p-4 font-semibold text-slate-300 text-right">Points</th>
                <th className="p-4 font-semibold text-slate-300 text-right hidden sm:table-cell">Exact Hits</th>
                <th className="p-4 font-semibold text-slate-300 text-right hidden sm:table-cell">Races</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(!leaderboard || leaderboard.length === 0) ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    No predictions scored yet. The season is waiting!
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry: any, index: number) => (
                  <tr key={entry.user_id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-center font-bold text-lg">
                      {index === 0 ? <Medal className="w-6 h-6 text-yellow-500 mx-auto" /> :
                       index === 1 ? <Medal className="w-6 h-6 text-slate-300 mx-auto" /> :
                       index === 2 ? <Medal className="w-6 h-6 text-amber-600 mx-auto" /> :
                       <span className="text-slate-500">{index + 1}</span>}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold">{entry.profiles?.display_name || 'Anonymous'}</div>
                    </td>
                    <td className="p-4 text-right font-black text-xl text-red-500">
                      {entry.total_points}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-400 hidden sm:table-cell">
                      {entry.exact_hits}
                    </td>
                    <td className="p-4 text-right text-slate-400 hidden sm:table-cell">
                      {entry.races_scored}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
