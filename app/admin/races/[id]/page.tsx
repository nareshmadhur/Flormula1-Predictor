import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, Plus, CheckCircle, Calculator, Settings, Users, CalendarSync, ExternalLink } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import DeleteRaceButton from './delete-button'
import CancelRaceButton from './cancel-button'
import BonusQuestionCard from './bonus-question-card'
import { OfficialResultsForm } from './official-results-form'
import { updateRace } from '@/app/actions/admin'
import { calculateRaceScoresAction } from '@/app/actions/scoring'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getProfileDisplayName } from '@/utils/profile-name'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { getAdminRaceStatusBadgeClasses, getAdminRaceStatusLabel } from '@/utils/admin-race-status'
import {
  buildOpenF1ScheduleReview,
  fetchOpenF1PodiumSuggestion,
  fetchOpenF1SeasonSchedule,
  type ExistingRaceForImport,
  type OpenF1CircuitLookup,
  type OpenF1ScheduleReviewRow,
} from '@/utils/openf1'
import { ADMIN_TIME_LABEL, formatAmsterdamDateTime, formatAmsterdamInputValue } from '@/utils/amsterdam-time'
import { FormActionButton } from '@/components/ui/form-action-button'
import { PageBackLink } from '@/components/ui/page-back-link'
import { OpenF1RaceSyncForm } from './openf1-race-sync-form'

export const revalidate = 0

type RaceRecord = {
  id: string
  season: number
  round: number
  race_name: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  circuit_id: string
  race_start_at: string
  prediction_lock_at: string
  fp1_at?: string | null
  fp2_at?: string | null
  fp3_at?: string | null
  quali_at?: string | null
  sprint_at?: string | null
  sprint_quali_at?: string | null
  external_race_key?: string | null
}

type DriverRecord = {
  id: string
  code: string
  full_name: string
}

type CircuitRecord = {
  id: string
  name: string
  city?: string | null
  country?: string | null
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
  revalidatePath('/admin/results')
  revalidatePath('/season')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
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
  const effectiveStatus = getEffectiveRaceStatus(typedRace)
  let suggestedPodium = null
  let openF1Review: OpenF1ScheduleReviewRow | null = null

  if (typedRace.external_race_key) {
    try {
      suggestedPodium = await fetchOpenF1PodiumSuggestion(typedRace.external_race_key, typedDrivers)
    } catch (error) {
      console.error('Failed to load OpenF1 podium suggestion', error)
    }

    try {
      const importedRaces = await fetchOpenF1SeasonSchedule(typedRace.season)
      const importedRace = importedRaces.find(
        (entry) => String(entry.meetingKey) === String(typedRace.external_race_key)
      )

      if (importedRace) {
        openF1Review =
          buildOpenF1ScheduleReview(
            [importedRace],
            [typedRace as ExistingRaceForImport],
            typedCircuits as OpenF1CircuitLookup[]
          )[0] || null
      }
    } catch (error) {
      console.error('Failed to load OpenF1 schedule preview', error)
    }
  }

  function formatReviewValue(label: string, value: string | null) {
    if (!value) return 'Not set'

    if (label === 'Circuit') {
      const circuit = typedCircuits.find((entry) => entry.id === value)
      return circuit ? `${circuit.name}${circuit.emoji ? ` ${circuit.emoji}` : ''}` : value
    }

    if (label === 'Source key') return value

    return formatAmsterdamDateTime(value) || value
  }

  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: predictionsCount } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('race_id', id)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div>
        <PageBackLink href="/admin" label="Back to race control" />
        <div className="flex justify-between items-start">
          <div>
            <div className="text-red-500 font-bold tracking-widest uppercase mb-1">Round {typedRace.round}</div>
            <h1 className="text-3xl font-black italic tracking-tighter">Manage {typedRace.race_name}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${getAdminRaceStatusBadgeClasses(effectiveStatus)}`}>
                Status: {getAdminRaceStatusLabel(effectiveStatus)}
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
          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2 flex items-center">
                  <CalendarSync className="w-5 h-5 mr-2 text-red-500" />
                  OpenF1 Sync
                </h2>
                <p className="text-sm text-slate-400">
                  Refresh weekend timings, race naming, and circuit match from OpenF1. Official results stay
                  manual, and the podium form below is prefilled whenever OpenF1 already has classified results.
                </p>
              </div>

              {openF1Review?.imported.sourceUrl && (
                <a
                  href={openF1Review.imported.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                >
                  Source
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              )}
            </div>

            {openF1Review ? (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                    Meeting key {openF1Review.imported.meetingKey}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                    {openF1Review.circuitMatch
                      ? `Circuit match: ${openF1Review.circuitMatch.name}`
                      : 'Circuit match needs review'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                    Race {formatAmsterdamDateTime(openF1Review.imported.raceStartAt) || 'Not set'}
                  </span>
                </div>

                {openF1Review.fieldChanges.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="text-sm font-bold text-amber-100">Source changes ready to apply</div>
                    <div className="mt-3 grid gap-3">
                      {openF1Review.fieldChanges.map((change) => (
                        <div
                          key={`${change.label}:${change.current}:${change.imported}`}
                          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                        >
                          <div className="font-semibold text-white">{change.label}</div>
                          <div className="mt-1 grid gap-1 text-slate-300 sm:grid-cols-2">
                            <div>
                              <span className="text-slate-500">Current</span>
                              <div>{formatReviewValue(change.label, change.current)}</div>
                            </div>
                            <div>
                              <span className="text-slate-500">OpenF1</span>
                              <div>{formatReviewValue(change.label, change.imported)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    This weekend is already aligned with the latest OpenF1 schedule snapshot.
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ['FP1', openF1Review.imported.fp1At],
                    ['FP2', openF1Review.imported.fp2At],
                    ['FP3', openF1Review.imported.fp3At],
                    ['Qualifying', openF1Review.imported.qualiAt],
                    ['Sprint Qualifying', openF1Review.imported.sprintQualiAt],
                    ['Sprint', openF1Review.imported.sprintAt],
                  ].map(([label, value]) =>
                    value ? (
                      <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                        <div className="mt-1 font-medium text-white">{formatAmsterdamDateTime(value) || value}</div>
                      </div>
                    ) : null
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                  If OpenF1 has classified race results, the official results form below is already prefilled with
                  the source podium suggestion. Saving still stays manual so you can review before publishing.
                </div>

                <div className="mt-4">
                  <OpenF1RaceSyncForm raceId={typedRace.id} disabled={!typedRace.external_race_key} />
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-300">
                {typedRace.external_race_key
                  ? 'OpenF1 did not return a current preview for this weekend just now. Try again from season sync if the upstream event changed.'
                  : 'This weekend does not have an OpenF1 source key yet. Run season sync first, then come back here for race-level refreshes.'}
              </div>
            )}
          </div>

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
                  <label className="block text-sm font-medium text-slate-400 mb-1">Race Start ({ADMIN_TIME_LABEL})</label>
                  <input name="race_start_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.race_start_at)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
               </div>
               <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">FP1 Start ({ADMIN_TIME_LABEL})</label>
                    <input name="fp1_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.fp1_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">FP2 Start ({ADMIN_TIME_LABEL})</label>
                    <input name="fp2_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.fp2_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">FP3 Start ({ADMIN_TIME_LABEL})</label>
                    <input name="fp3_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.fp3_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Qualifying ({ADMIN_TIME_LABEL})</label>
                    <input name="quali_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.quali_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Sprint Qualifying ({ADMIN_TIME_LABEL})</label>
                    <input name="sprint_quali_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.sprint_quali_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Sprint ({ADMIN_TIME_LABEL})</label>
                    <input name="sprint_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.sprint_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
               </div>
               <p className="mt-2 text-xs text-slate-500">Predictions lock automatically at FP1 - 5m. Manual edits here override imported schedule data.</p>
               <FormActionButton idleLabel="Update details" pendingLabel="Saving details..." tone="primary" className="mt-4" />
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
                <FormActionButton idleLabel="Save question" pendingLabel="Saving question..." tone="amber" className="mt-4 text-lg italic tracking-wider" />
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

                 <FormActionButton idleLabel="Submit prediction for user" pendingLabel="Saving prediction..." tone="secondary" className="mt-2" />
             </form>
          </div>

          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-red-500" /> Official Results</h2>
             <p className="mb-4 text-sm text-slate-400">
               Save the published podium and any bonus answers here. When OpenF1 has classified results, matching
               drivers are suggested automatically before you save.
             </p>
             
             <OfficialResultsForm
               raceId={typedRace.id}
               action={saveResults}
               drivers={typedDrivers}
               bonusQuestions={typedBonusQuestions}
               existingResult={typedExistingResult}
               existingBonusAnswers={typedExistingBonusAnswers}
               suggestedPodium={suggestedPodium}
             />
          </div>

          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-4 flex items-center"><Calculator className="w-5 h-5 mr-2 text-red-500" /> Scoring</h2>
             <p className="text-sm text-slate-400 mb-4">
               Keep scoring manual for now, but safe to rerun. This recalculates from the current predictions, official results, and bonus answers.
             </p>

             <form action={calculateRaceScoresAction}>
                <input type="hidden" name="race_id" value={typedRace.id} />
                <FormActionButton
                  idleLabel={typedExistingResult ? 'Recalculate scores' : 'Save results first'}
                  pendingLabel="Recalculating scores..."
                  tone="light"
                  disabled={!typedExistingResult}
                  className="text-lg italic tracking-widest disabled:opacity-50"
                />
             </form>
          </div>
        </div>

      </div>
    </div>
  )
}
