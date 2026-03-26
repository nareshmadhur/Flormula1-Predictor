'use client'

import { createClient } from '@/utils/supabase/client'
import { redirect } from 'next/navigation'
import { Database, Plus, Trash2, Power } from 'lucide-react'
import { ToggleDriverButton } from './toggle-driver-button'
import { DeleteDriverButton } from './delete-driver-button'
import { AddDriverForm } from './add-driver-form'
import { useState, useEffect } from 'react'

export default function AdminDataPage() {
  return <AdminDataPageClient />
}

function AdminDataPageClient() {
  const [data, setData] = useState<{
    constructors: any[],
    drivers: any[],
    profile: any,
    user: any
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        redirect('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') {
        setData({ constructors: [], drivers: [], profile: null, user: null })
        setLoading(false)
        return
      }

      const { data: constructors } = await supabase.from('constructors').select('*').order('name')
      const { data: drivers } = await supabase.from('drivers').select('*, constructors(name, short_code)').order('full_name')

      setData({
        constructors: constructors || [],
        drivers: drivers || [],
        profile,
        user
      })
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="p-20 text-center text-slate-400">Loading...</div>
  }

  if (!data?.user) {
    redirect('/login')
  }

  if (data?.profile?.role !== 'admin') {
    return <div className="p-20 text-center text-red-500 font-bold">Access Denied</div>
  }

  const { constructors, drivers } = data

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

        <AddDriverForm constructors={constructors || []} />

      </div>
    </div>
  )
}
