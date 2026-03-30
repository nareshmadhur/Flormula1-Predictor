import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { History, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
import { TenantAssignmentRequired } from '@/components/ui/tenant-assignment-required'

export const revalidate = 0

type HistoryPrediction = {
  id: string
  race_id: string
  races?: {
    id: string
    round: number
    race_name: string
    status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
    race_start_at: string
    prediction_lock_at: string
    circuits?: {
      emoji?: string | null
      name?: string | null
      country?: string | null
    } | null
  } | null
}

type ScoreRow = {
  race_id: string
  total_points: number
  podium_points: number
  bonus_points: number
}

export default async function UserHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantContext = await getUserTenantContext(supabase, user.id)

  if (!tenantContext.tenantId) {
    return <TenantAssignmentRequired isAdmin={tenantContext.role === 'admin'} />
  }

  // Fetch all user predictions with race details
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select(`
      *,
      races (
        id, round, race_name, status,
        circuits ( emoji, name, country )
      )
    `)
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })

  if (error) console.error('Predictions fetch error:', error)

  const { data: scores } = await supabase
    .from('user_race_scores')
    .select('*')
    .eq('user_id', user.id)

  const typedPredictions = (predictions || []) as HistoryPrediction[]
  const typedScores = (scores || []) as ScoreRow[]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black italic tracking-tighter flex items-center">
          <History className="w-8 h-8 mr-3 text-red-500" /> MY HISTORY
        </h1>
        <p className="text-slate-400">Review your past predictions and scores.</p>
        <div className="mt-3">
          <TenantContextBanner tenantName={tenantContext.tenantName} />
        </div>
      </div>

      <div className="grid gap-6">
        {typedPredictions.length === 0 ? (
          <div className="bg-card border border-white/5 rounded-2xl p-12 text-center shadow-xl text-slate-400">
            You haven&apos;t made any predictions yet. Check the Upcoming Races!
          </div>
        ) : (
           typedPredictions.map((p) => {
             const score = typedScores.find((entry) => entry.race_id === p.race_id)
             const isScored = p.races?.status === 'scored'
             const raceStatus = p.races ? getEffectiveRaceStatus(p.races) : null

             return (
               <div key={p.id} className="bg-card border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between md:items-center gap-6 shadow-xl hover:bg-white/[0.02] transition-colors">
                 
                 <div className="flex-1 space-y-1">
                   <div className="text-sm font-bold text-red-500 uppercase tracking-widest">
                     Round {p.races?.round}
                   </div>
                   <h2 className="text-2xl font-bold mb-1">{p.races?.race_name}</h2>
                   <div className="text-slate-400 text-sm">
                     {p.races?.circuits?.emoji} {p.races?.circuits?.name}, {p.races?.circuits?.country}
                   </div>
                 </div>

                 {isScored && score ? (
                   <div className="flex gap-4 items-center">
                     <div className="bg-black/30 border border-white/5 p-4 rounded-xl text-center min-w-24">
                       <div className="text-xs text-slate-500 font-bold uppercase mb-1">Total</div>
                       <div className="text-3xl font-black italic text-red-500">{score.total_points}</div>
                     </div>
                     <div className="bg-black/30 border border-white/5 p-4 rounded-xl text-center min-w-24 hidden sm:block">
                       <div className="text-xs text-slate-500 font-bold uppercase mb-1">Podium</div>
                       <div className="text-xl font-bold">{score.podium_points}</div>
                     </div>
                     <div className="bg-black/30 border border-white/5 p-4 rounded-xl text-center min-w-24 hidden sm:block">
                       <div className="text-xs text-slate-500 font-bold uppercase mb-1">Bonus</div>
                       <div className="text-xl font-bold">{score.bonus_points}</div>
                     </div>
                   </div>
                 ) : (
                   <div className="flex gap-4 items-center">
                     <div className="bg-black/30 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-center font-bold text-sm h-full flex flex-col justify-center">
                       {raceStatus === 'completed' ? 'Awaiting Score' : 'Upcoming Race'}
                     </div>
                   </div>
                 )}

                 <div className="shrink-0">
                   <Link href={`/race/${p.race_id}/predict`} className="inline-flex items-center text-red-400 hover:text-red-300 font-bold transition-colors">
                     View Details <ChevronRight className="w-5 h-5 ml-1" />
                   </Link>
                 </div>
               </div>
             )
           })
        )}
      </div>
    </div>
  )
}
