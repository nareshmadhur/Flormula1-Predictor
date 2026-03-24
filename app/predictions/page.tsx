import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Calendar, MapPin, ChevronRight, Lock } from 'lucide-react'
import { format, isPast } from 'date-fns'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function UpcomingRacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch upcoming races
  const { data: races, error } = await supabase
    .from('races')
    .select(`
      *,
      circuits(name, country, emoji)
    `)
    .in('status', ['upcoming', 'locked'])
    .order('race_start_at', { ascending: true })

  // Fetch user's existing predictions to show checkmarks
  const { data: predictions } = await supabase
    .from('predictions')
    .select('race_id')
    .eq('user_id', user.id)

  const predictedRaceIds = new Set(predictions?.map(p => p.race_id) || [])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black italic tracking-tighter">UPCOMING RACES</h1>
        <p className="text-slate-400">Lock in your predictions before the deadline.</p>
      </div>

      <div className="grid gap-6">
        {(!races || races.length === 0) ? (
          <div className="bg-card border border-white/5 rounded-2xl p-12 text-center shadow-xl">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-300">No Upcoming Races</h3>
            <p className="text-slate-500 mt-2">Check back later when the season calendar is updated.</p>
          </div>
        ) : (
          races.map((race: any) => {
            const isLocked = isPast(new Date(race.prediction_lock_at)) || race.status === 'locked'
            const hasPredicted = predictedRaceIds.has(race.id)

            return (
              <div key={race.id} className={`group bg-card border ${hasPredicted ? 'border-green-500/30' : 'border-white/5'} rounded-2xl overflow-hidden shadow-xl transition-all hover:bg-white/[0.02]`}>
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="flex bg-black/40 rounded-xl p-4 border border-white/5 items-center justify-center w-full sm:w-24 shrink-0">
                    <div className="text-center">
                      <div className="text-xs text-red-500 font-bold uppercase tracking-wider">Round</div>
                      <div className="text-3xl font-black italic">{race.round}</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-2xl font-bold">{race.race_name}</h2>
                      {hasPredicted && (
                        <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                          Predicted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-slate-400">
                      <MapPin className="w-4 h-4 mr-1 text-slate-500" />
                      {race.circuits?.name}, {race.circuits?.country} {race.circuits?.emoji}
                    </div>
                    
                    <div className="flex items-center text-sm mt-4 space-x-4">
                      <div className="text-slate-300 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-slate-500 mr-2">Race:</span>
                        {format(new Date(race.race_start_at), 'MMM d, p')}
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border flex items-center ${isLocked ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                        {isLocked ? <Lock className="w-3.5 h-3.5 mr-1.5" /> : <span className="text-amber-500/50 mr-2">Lock:</span>}
                        {format(new Date(race.prediction_lock_at), 'MMM d, p')}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                    <Link
                      href={`/race/${race.id}/predict`}
                      className={`w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold transition-all ${
                        isLocked
                          ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                      }`}
                    >
                      {isLocked ? 'View Prediction' : (hasPredicted ? 'Edit Podium' : 'Predict Podium')}
                      {!isLocked && <ChevronRight className="w-5 h-5 ml-1" />}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
