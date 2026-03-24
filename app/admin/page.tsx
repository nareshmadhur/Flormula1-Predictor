import { createClient } from '@/utils/supabase/server'
import { createRace } from '@/app/actions/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Settings, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify Admin status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
         <h1 className="text-3xl font-bold text-red-500 mb-4">Access Denied</h1>
         <p className="text-slate-400">You must be an administrator to view this page.</p>
         <Link href="/" className="mt-6 text-slate-300 underline">Return Home</Link>
      </div>
    )
  }

  // Fetch all races
  const { data: races } = await supabase
    .from('races')
    .select('*, circuits(name, emoji)')
    .order('round', { ascending: true })

  // Fetch circuits for the 'create' form
  const { data: circuits } = await supabase.from('circuits').select('*').order('name')

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter flex items-center text-red-500">
            <Settings className="w-8 h-8 mr-3" /> RACE CONTROL
          </h1>
          <p className="text-slate-400">Manage season schedule, operations, and scoring.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Race List (Left/Main col) */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold mb-4">Season Calendar</h2>
          
          <div className="bg-card border border-white/5 rounded-2xl shadow-xl overflow-hidden divide-y divide-white/5">
            {(!races || races.length === 0) ? (
              <div className="p-8 text-center text-slate-500 italic">No races defined.</div>
            ) : (
              races.map((race: any) => (
                 <Link href={`/admin/races/${race.id}`} key={race.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-6 hover:bg-white/[0.02] transition-colors group">
                   <div className="space-y-1">
                     <div className="text-xs font-bold text-red-500 uppercase tracking-widest">
                       Round {race.round} • {race.season}
                     </div>
                     <div className="text-lg font-bold">{race.race_name}</div>
                     <div className="text-slate-400 text-sm">{race.circuits?.name} {race.circuits?.emoji}</div>
                   </div>
                   
                   <div className="flex items-center space-x-6 mt-4 sm:mt-0">
                     <div className="hidden sm:block text-right">
                       <div className="text-xs text-slate-500 uppercase font-bold">Status</div>
                       <div className={`text-sm font-medium ${
                         race.status === 'scored' ? 'text-green-500' :
                         race.status === 'upcoming' ? 'text-amber-500' : 'text-slate-400'
                       }`}>
                         {race.status.toUpperCase()}
                       </div>
                     </div>
                     <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-red-500 transition-colors" />
                   </div>
                 </Link>
              ))
            )}
          </div>
        </div>

        {/* Right col: Utilities & Create */}
        <div className="space-y-6">
          
          <Link href="/admin/data" className="bg-card border border-white/5 p-6 rounded-2xl shadow-xl hover:bg-white/[0.02] transition-colors flex items-center justify-between group block">
             <div>
               <h2 className="text-xl font-bold mb-1">Grid Data</h2>
               <p className="text-sm text-slate-400">Manage Drivers & Teams</p>
             </div>
             <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-red-500 transition-colors" />
          </Link>

          <h2 className="text-xl font-bold mb-4 pt-4 border-t border-white/10">Add Race</h2>
          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <form action={createRace} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Season Year</label>
                  <input name="season" type="number" defaultValue={2024} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Round Number</label>
                  <input name="round" type="number" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Race Name</label>
                  <input name="race_name" type="text" placeholder="e.g. Bahrain Grand Prix" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Circuit</label>
                  <select name="circuit_id" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                    <option value="">Select Circuit</option>
                    {circuits?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name} {c.emoji}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Race Start (UTC)</label>
                  <input name="race_start_at" type="datetime-local" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm" />
               </div>
               
               <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-lg italic tracking-widest rounded-xl px-4 py-4 mt-6 transition-all flex justify-center items-center shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)]">
                 <Plus className="w-6 h-6 mr-2" /> CREATE RACE
               </button>
             </form>
          </div>
        </div>

      </div>
    </div>
  )
}
