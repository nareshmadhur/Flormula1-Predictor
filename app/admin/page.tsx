import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, ChevronRight } from 'lucide-react'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { CreateRaceForm } from '@/components/ui/create-race-form'
import { MaintenanceSection } from '@/components/ui/maintenance-section'

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
                         getEffectiveRaceStatus(race) === 'scored' ? 'text-green-500' :
                         getEffectiveRaceStatus(race) === 'cancelled' ? 'text-red-400' :
                         getEffectiveRaceStatus(race) === 'upcoming' ? 'text-amber-500' : 'text-slate-400'
                       }`}>
                         {getEffectiveRaceStatus(race).toUpperCase()}
                       </div>
                     </div>
                     <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-red-500 transition-colors" />
                   </div>
                 </Link>
              ))
            )}
          </div>
        </div>

        {/* Right col: Utilities */}
        <div className="space-y-6">

          <Link href="/admin/data" className="bg-card border border-white/5 p-6 rounded-2xl shadow-xl hover:bg-white/[0.02] transition-colors flex items-center justify-between group block">
             <div>
               <h2 className="text-xl font-bold mb-1">Grid Data</h2>
               <p className="text-sm text-slate-400">Manage Drivers & Teams</p>
             </div>
             <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-red-500 transition-colors" />
          </Link>

          <MaintenanceSection />

        </div>

      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold">Create New Race</h2>
        <CreateRaceForm circuits={circuits || []} />
      </div>
    </div>
  )
}
