import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, Plus, CheckCircle, Calculator, Settings, Users } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import DeleteRaceButton from './delete-button'
import CancelRaceButton from './cancel-button'
import BonusQuestionCard from './bonus-question-card'
import { updateRace } from '@/app/actions/admin'
import { calculateRaceScoresAction } from '@/app/actions/scoring'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getProfileDisplayName } from '@/utils/profile-name'

export const revalidate = 0

type RaceRecord = {
  id: string
  round: number
  race_name: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  circuit_id: string
  race_start_at: string
  fp1_at?: string | null
}

type DriverRecord = {
  id: string
  code: string
  full_name: string
}

type CircuitRecord = {
  id: string
  name: string
  emoji?: string | null
}

type BonusOptionRecord = {
  id: string
  label?: string | null
}

type BonusQuestionRecord = {
  id: string
  question_text: string
  bonus_options?: BonusOptionRecord[]
}

type RaceResultRecord = {
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
}

type RaceBonusAnswerRecord = {
  bonus_question_id: string
  correct_bonus_option_id: string
}

type ProfileRecord = {
  id: string
  display_name?: string | null
  email?: string | null
}

// Server actions for this page
async function addBonusQuestion(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  if (!access?.isPlatformAdmin) return

  const raceId = formData.get('race_id') as string
  const questionText = formData.get('question_text') as string
  const points = parseInt(formData.get('points') as string)
  const optionLabels = Array.from(formData.getAll('options')) as string[]

  const { data: question } = await supabase.from('bonus_questions').insert({
    race_id: raceId,
    question_text: questionText,
    points
  }).select().single()

  if (question) {
    const options = optionLabels.filter(l => l.trim()).map(label => ({
      bonus_question_id: question.id,
      option_type: 'custom_text',
      label
    }))
    if (options.length > 0) {
      await supabase.from('bonus_options').insert(options)
    }
  }
  revalidatePath(`/admin/races/${raceId}`)
}

async function saveResults(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  if (!access?.isPlatformAdmin) return

  const raceId = formData.get('race_id') as string
  const p1 = formData.get('p1_driver_id') as string
  const p2 = formData.get('p2_driver_id') as string
  const p3 = formData.get('p3_driver_id') as string
  
  // Upsert race results
  await supabase.from('race_results').upsert({
    race_id: raceId,
    p1_driver_id: p1,
    p2_driver_id: p2,
    p3_driver_id: p3,
    entered_by: access.userId
  }, { onConflict: 'race_id' })

  // Insert bonus answers
  const bonusIds = Array.from(formData.keys()).filter(k => k.startsWith('bonus_'))
  
  // Clear old
  await supabase.from('race_bonus_answers').delete().eq('race_id', raceId)
  
  const inserts = bonusIds.map(key => ({
    race_id: raceId,
    bonus_question_id: key.replace('bonus_', ''),
    correct_bonus_option_id: formData.get(key) as string
  }))

  if (inserts.length > 0) {
    await supabase.from('race_bonus_answers').insert(inserts)
  }

  await supabase.from('races').update({ status: 'completed' }).eq('id', raceId)

  revalidatePath(`/admin/races/${raceId}`)
}

export async function proxyPrediction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  if (!access?.isPlatformAdmin) return

  const raceId = formData.get('race_id') as string
  const targetUserId = formData.get('user_id') as string
  const p1 = formData.get('p1') as string
  const p2 = formData.get('p2') as string
  const p3 = formData.get('p3') as string

  if (p1 === p2 || p1 === p3 || p2 === p3) {
      // In production we would return an error toast, but here we just throw or abort
      return
  }

  const { data: existing } = await supabase.from('predictions').select('id').eq('race_id', raceId).eq('user_id', targetUserId).maybeSingle()
  
  if (existing) {
     await supabase.from('predictions').update({ p1_driver_id: p1, p2_driver_id: p2, p3_driver_id: p3, submitted_at: new Date().toISOString() }).eq('id', existing.id)
  } else {
     await supabase.from('predictions').insert({ race_id: raceId, user_id: targetUserId, p1_driver_id: p1, p2_driver_id: p2, p3_driver_id: p3, submitted_at: new Date().toISOString() })
  }
  
  revalidatePath(`/admin/races/${raceId}`)
}

// Scoring action imported from '@/app/actions/scoring'

export default async function RaceAdminPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params
  
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  if (!access) redirect('/login')

  if (!access.isPlatformAdmin) {
    return <div className="p-20 text-center text-red-500 font-bold">Platform admin access required.</div>
  }

  const { data: race } = await supabase.from('races').select('*, circuits(name)').eq('id', id).single()
  if (!race) return <div className="p-20 text-center">Race not found.</div>

  const { data: drivers } = await supabase.from('drivers').select('*').order('full_name')
  const { data: circuits } = await supabase.from('circuits').select('*').order('name')
  const { data: bonusQuestions } = await supabase.from('bonus_questions').select('*, bonus_options(*)').eq('race_id', id)
  const { data: existingResult } = await supabase.from('race_results').select('*').eq('race_id', id).single()
  const { data: existingBonusAnswers } = await supabase.from('race_bonus_answers').select('*').eq('race_id', id)
  const { data: profiles } = await supabase.from('profiles').select('*').order('display_name')

  const typedRace = race as RaceRecord
  const typedDrivers = (drivers || []) as DriverRecord[]
  const typedCircuits = (circuits || []) as CircuitRecord[]
  const typedBonusQuestions = (bonusQuestions || []) as BonusQuestionRecord[]
  const typedExistingResult = (existingResult || null) as RaceResultRecord | null
  const typedExistingBonusAnswers = (existingBonusAnswers || []) as RaceBonusAnswerRecord[]
  const typedProfiles = (profiles || []) as ProfileRecord[]

  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: predictionsCount } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('race_id', id)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-red-500 font-bold tracking-widest uppercase mb-1">Round {typedRace.round}</div>
            <h1 className="text-3xl font-black italic tracking-tighter">Manage {typedRace.race_name}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${
                 typedRace.status === 'scored' ? 'bg-green-500/20 text-green-500 border-green-500/30' :
                 typedRace.status === 'completed' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' :
                 typedRace.status === 'cancelled' ? 'bg-red-400/20 text-red-400 border-red-400/30' :
                 'bg-slate-800 text-slate-300'
              }`}>
                Status: {typedRace.status.toUpperCase()}
              </span>
              <span className="flex items-center text-sm font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-lg border border-white/5">
                <Users className="w-4 h-4 mr-2 text-slate-400" />
                {predictionsCount} / {totalUsers} Predicted
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            <CancelRaceButton raceId={typedRace.id} raceStatus={typedRace.status} />
            <DeleteRaceButton raceId={typedRace.id} />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        <div className="space-y-6">
          {/* Edit Details */}
          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-red-500" /> Edit Race Details</h2>
             <form action={updateRace} className="space-y-4">
               <input type="hidden" name="race_id" value={typedRace.id} />
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Race Name</label>
                  <input name="race_name" defaultValue={typedRace.race_name} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Circuit</label>
                  <select name="circuit_id" defaultValue={typedRace.circuit_id} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                    {typedCircuits.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name} {c.emoji}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Race Start (UTC)</label>
                  <input name="race_start_at" type="datetime-local" defaultValue={new Date(typedRace.race_start_at).toISOString().slice(0, 16)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">FP1 Start (UTC)</label>
                  <input name="fp1_at" type="datetime-local" defaultValue={typedRace.fp1_at ? new Date(typedRace.fp1_at).toISOString().slice(0, 16) : ''} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  <p className="mt-2 text-xs text-slate-500">Predictions now lock automatically 5 minutes before FP1. If FP1 is blank, the app temporarily falls back to race start.</p>
               </div>
               <button className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl px-4 py-3 mt-4 transition-colors">
                 Update Details
               </button>
             </form>
          </div>

          {/* Bonus Questions Management */}
          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4 flex items-center"><AlertCircle className="w-5 h-5 mr-2 text-red-500" /> Bonus Questions</h2>
             
             {bonusQuestions?.length === 0 ? (
               <p className="text-slate-500 text-sm mb-6">No bonus questions defined for this race.</p>
             ) : (
               <div className="space-y-4 mb-6">
                 {typedBonusQuestions.map((q) => (
                   <BonusQuestionCard key={q.id} question={q} raceId={typedRace.id} />
                 ))}
               </div>
             )}

             <form action={addBonusQuestion} className="space-y-3 pt-6 border-t border-white/10">
                <input type="hidden" name="race_id" value={typedRace.id} />
                <h3 className="text-sm font-bold text-slate-300">Add New Bonus Question</h3>
                <input name="question_text" placeholder="Question Text" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
                <input name="points" type="number" defaultValue={1} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-bold uppercase">Options</p>
                  <input name="options" placeholder="Option A" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm" />
                  <input name="options" placeholder="Option B" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm" />
                  <input name="options" placeholder="Option C (Optional)" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm" />
                  <input name="options" placeholder="Option D (Optional)" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm" />
                </div>
                <button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black italic tracking-wider text-lg rounded-xl px-4 py-4 mt-4 transition-all shadow-lg hover:shadow-amber-500/30">
                  SAVE QUESTION
                </button>
             </form>
          </div>
        </div>

        {/* Results Entry */}
        <div className="space-y-6">

          {/* Proxy Prediction Form */}
          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4 flex items-center"><Plus className="w-5 h-5 mr-2 text-red-500" /> Log Historic Prediction</h2>
             <p className="text-sm text-slate-400 mb-4">Select a user to manually insert or override their exact podium prediction for this race.</p>
             <form action={proxyPrediction} className="space-y-4">
                 <input type="hidden" name="race_id" value={typedRace.id} />
                 
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Select User</label>
                    <select name="user_id" required defaultValue="" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                      <option value="" disabled className="bg-slate-900 text-white">Choose user</option>
                      {typedProfiles.map((p) => (
                        <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                          {getProfileDisplayName(p.display_name, p.email)}
                        </option>
                      ))}
                    </select>
                 </div>

                 <div className="grid grid-cols-3 gap-2">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">P1</label>
                        <select name="p1" required defaultValue="" className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-sm">
                           <option value="" disabled>---</option>
                           {typedDrivers.map((d) => <option key={d.id} value={d.id} className="bg-slate-900 text-white">{d.code}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">P2</label>
                        <select name="p2" required defaultValue="" className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-sm">
                           <option value="" disabled>---</option>
                           {typedDrivers.map((d) => <option key={d.id} value={d.id} className="bg-slate-900 text-white">{d.code}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">P3</label>
                        <select name="p3" required defaultValue="" className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-sm">
                           <option value="" disabled>---</option>
                           {typedDrivers.map((d) => <option key={d.id} value={d.id} className="bg-slate-900 text-white">{d.code}</option>)}
                        </select>
                     </div>
                 </div>

                 <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl px-4 py-3 mt-2 transition-colors">
                   Submit Prediction for User
                 </button>
             </form>
          </div>

          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-red-500" /> Official Results</h2>
             
             <form action={saveResults} className="space-y-6">
               <input type="hidden" name="race_id" value={typedRace.id} />
               
               <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
                 <h3 className="font-bold text-sm text-slate-300 uppercase">Podium</h3>
                 {[1, 2, 3].map(pos => (
                    <div key={pos}>
                      <label className="block text-xs font-bold text-slate-500 mb-1">P{pos}</label>
                      <select name={`p${pos}_driver_id`} defaultValue={typedExistingResult?.[`p${pos}_driver_id` as keyof RaceResultRecord] || ''} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                        <option value="" disabled className="bg-slate-900 text-white">Select Driver</option>
                        {typedDrivers.map((d) => (
                          <option key={d.id} value={d.id} className="bg-slate-900 text-white">{d.code} - {d.full_name}</option>
                        ))}
                      </select>
                    </div>
                 ))}
               </div>

               {typedBonusQuestions.length > 0 && (
                 <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
                   <h3 className="font-bold text-sm text-slate-300 uppercase">Bonus Answers</h3>
                   {typedBonusQuestions.map((q) => {
                     const existingAns = typedExistingBonusAnswers.find((a) => a.bonus_question_id === q.id)
                     return (
                       <div key={q.id}>
                         <label className="block text-xs font-bold text-slate-500 mb-1">{q.question_text}</label>
                         <select name={`bonus_${q.id}`} defaultValue={existingAns?.correct_bonus_option_id || ''} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                           <option value="" disabled className="bg-slate-900 text-white">Select Correct Option</option>
                           {q.bonus_options?.map((o) => (
                             <option key={o.id} value={o.id} className="bg-slate-900 text-white">{o.label}</option>
                           ))}
                         </select>
                       </div>
                     )
                   })}
                 </div>
               )}

               <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl px-4 py-3 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all">
                 Save Official Results
               </button>
             </form>
          </div>

          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4 flex items-center"><Calculator className="w-5 h-5 mr-2 text-red-500" /> Scoring</h2>
             <p className="text-sm text-slate-400 mb-4">
               Once official results are saved, run the scoring calculation to update user points and the global leaderboard.
             </p>

             <form action={calculateRaceScoresAction}>
                <input type="hidden" name="race_id" value={typedRace.id} />
                <button disabled={!typedExistingResult} className="w-full bg-slate-100 hover:bg-white text-black font-black italic tracking-widest text-lg rounded-xl px-4 py-3 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed">
                  CALCULATE SCORES
                </button>
             </form>
          </div>
        </div>

      </div>
    </div>
  )
}
