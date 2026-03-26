import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { isPast } from 'date-fns'
import { Flag, Lock, AlertCircle } from 'lucide-react'
import PredictionForm from './prediction-form'
import { getEffectiveRaceStatus } from '@/utils/race-status'

export default async function PredictPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch race details
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*, circuits(name, country, emoji)')
    .eq('id', id)
    .single()

  if (raceError || !race) {
    return <div className="text-center p-12 text-slate-400">Race not found.</div>
  }

  const effectiveStatus = getEffectiveRaceStatus(race)
  const isLocked = effectiveStatus === 'locked' || effectiveStatus === 'completed' || effectiveStatus === 'cancelled'

  // Fetch drivers list
  const { data: drivers } = await supabase
    .from('drivers')
    .select('*, constructors(name, short_code)') // removed color
    .eq('active', true)
    .order('full_name')

  // Fetch bonus questions and options
  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('*, bonus_options(*)')
    .eq('race_id', id)
    .eq('is_active', true)
    .order('display_order')

  // Fetch user's existing prediction
  const { data: prediction } = await supabase
    .from('predictions')
    .select('*')
    .eq('race_id', id)
    .eq('user_id', user.id)
    .single()

  let predictionBonusAnswers = []
  if (prediction) {
    const { data: pba } = await supabase
      .from('prediction_bonus_answers')
      .select('*')
      .eq('prediction_id', prediction.id)
    predictionBonusAnswers = pba || []
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="bg-card border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Flag className="w-48 h-48" />
        </div>
        
        <div className="relative z-10 space-y-2">
          <div className="text-sm font-bold text-red-500 uppercase tracking-widest flex items-center space-x-2">
            <span>Round {race.round}</span>
            {isLocked && (
              <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center">
                <Lock className="w-3 h-3 mr-1" /> Locked
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
            {race.race_name}
          </h1>
          <p className="text-xl text-slate-300 flex items-center space-x-2 pb-4">
            <span className="text-2xl">{race.circuits?.emoji}</span>
            <span>{race.circuits?.name}, {race.circuits?.country}</span>
          </p>
        </div>
      </div>

      {!isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3 text-amber-500">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">
            Predictions close exactly 5 minutes before the formation lap starts. Ensure you lock in your choices!
          </div>
        </div>
      )}

      <PredictionForm 
        race={race} 
        drivers={drivers} 
        bonusQuestions={bonusQuestions} 
        existingPrediction={prediction} 
        existingBonusAnswers={predictionBonusAnswers}
        isLocked={isLocked}
      />
    </div>
  )
}
