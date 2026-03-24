import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Database, Plus, Trash2, Power } from 'lucide-react'
import { addDriver, toggleDriverActive, deleteDriver } from '@/app/actions/admin-data'

export const revalidate = 0

// Small wrapper form components for the Server Actions
function ToggleDriverButton({ id, active }: { id: string, active: boolean }) {
  return (
    <form action={async () => {
      'use server'
      await toggleDriverActive(id, active)
    }}>
      <button className={`p-2 rounded-lg transition-colors ${active ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
        <Power className="w-4 h-4" />
      </button>
    </form>
  )
}

function DeleteDriverButton({ id }: { id: string }) {
  return (
    <form action={async () => {
      'use server'
      await deleteDriver(id)
    }}>
      <button className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </form>
  )
}

export default async function AdminDataPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return <div className="p-20 text-center text-red-500 font-bold">Access Denied</div>
  }

  const { data: constructors } = await supabase.from('constructors').select('*').order('name')
  const { data: drivers } = await supabase.from('drivers').select('*, constructors(name, short_code)').order('full_name')

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black italic tracking-tighter flex items-center text-red-500">
          <Database className="w-8 h-8 mr-3" /> REFERENCE DATA
        </h1>
        <p className="text-slate-400">Manage drivers, teams, and circuits for the application.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Drivers List */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold mb-4">Drivers Database</h2>
          <div className="bg-card border border-white/5 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-slate-400 text-sm">
                     <th className="p-4 font-bold">Driver</th>
                     <th className="p-4 font-bold">Team</th>
                     <th className="p-4 font-bold text-center">Status</th>
                     <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {drivers?.map((d: any) => (
                    <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 flex items-center space-x-3">
                         <span className="text-2xl">{d.emoji}</span>
                         <div>
                           <div className="font-bold text-base text-slate-200">{d.full_name}</div>
                           <div className="text-xs font-bold text-red-500">{d.code}</div>
                         </div>
                      </td>
                      <td className="p-4 font-medium text-slate-300">
                        {d.constructors?.name}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${d.active ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                          {d.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end space-x-2">
                           <ToggleDriverButton id={d.id} active={d.active} />
                           <DeleteDriverButton id={d.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add Driver Forms */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold mb-4">Add Driver</h2>
          <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
             <form action={addDriver} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                  <input name="full_name" placeholder="e.g. Max Verstappen" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Code</label>
                    <input name="code" placeholder="VER" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 uppercase" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Emoji</label>
                    <input name="emoji" placeholder="🇳🇱" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
                 </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Constructor</label>
                  <select name="constructor_id" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                    <option value="" disabled className="bg-slate-900 text-white">Select Constructor</option>
                    {constructors?.map((c: any) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                    ))}
                  </select>
               </div>
               <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black italic tracking-widest text-base rounded-xl px-4 py-3 mt-4 transition-all flex justify-center items-center shadow-lg hover:shadow-amber-500/30">
                 <Plus className="w-5 h-5 mr-2" /> CREATE DRIVER
               </button>
             </form>
          </div>
        </div>

      </div>
    </div>
  )
}
