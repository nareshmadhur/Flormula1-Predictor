'use client'

import { createClient } from '@/utils/supabase/client'
import { redirect } from 'next/navigation'
import { Database } from 'lucide-react'
import { ToggleDriverButton } from './toggle-driver-button'
import { DeleteDriverButton } from './delete-driver-button'
import { AddDriverForm } from './add-driver-form'
import { AddCircuitForm } from './add-circuit-form'
import { EditCircuitForm } from './edit-circuit-form'
import { PageBackLink } from '@/components/ui/page-back-link'
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'

type AdminProfile = {
  role?: 'user' | 'admin' | null
  tenant_id?: string | null
  admin_scope?: 'platform' | 'tenant' | null
}

type Constructor = {
  id: string
  name: string
  short_code: string
  emoji?: string | null
}

type DriverRow = {
  id: string
  full_name: string
  code: string
  emoji?: string | null
  active: boolean
  constructors?: {
    name?: string | null
    short_code?: string | null
  } | null
}

type CircuitRow = {
  id: string
  name: string
  city?: string | null
  country?: string | null
  emoji?: string | null
}

type AdminDataState = {
  constructors: Constructor[]
  drivers: DriverRow[]
  circuits: CircuitRow[]
  profile: AdminProfile | null
  user: User | null
  isPlatformAdmin: boolean
}

export default function AdminDataPage() {
  return <AdminDataPageClient />
}

function AdminDataPageClient() {
  const [data, setData] = useState<AdminDataState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        redirect('/login')
        return
      }

      let profileQuery = await supabase
        .from('profiles')
        .select('role, tenant_id, admin_scope')
        .eq('id', user.id)
        .single()

      if (profileQuery.error && profileQuery.error.message?.includes('admin_scope')) {
        profileQuery = await supabase
          .from('profiles')
          .select('role, tenant_id')
          .eq('id', user.id)
          .single()
      }

      const profile = profileQuery.data as AdminProfile | null
      const isPlatformAdmin =
        profile?.role === 'admin' &&
        (profile.admin_scope
          ? profile.admin_scope === 'platform'
          : !profile?.tenant_id)

      if (!isPlatformAdmin) {
        setData({ constructors: [], drivers: [], circuits: [], profile: null, user: null, isPlatformAdmin: false })
        setLoading(false)
        return
      }

      const { data: constructors } = await supabase.from('constructors').select('*').order('name')
      const { data: drivers } = await supabase.from('drivers').select('*, constructors(name, short_code)').order('full_name')
      const { data: circuits } = await supabase.from('circuits').select('id, name, city, country, emoji').order('name')

      setData({
        constructors: constructors || [],
        drivers: drivers || [],
        circuits: circuits || [],
        profile,
        user,
        isPlatformAdmin,
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

  if (!data?.isPlatformAdmin) {
    return <div className="p-20 text-center text-red-500 font-bold">Platform admin access required</div>
  }

  const { constructors, drivers, circuits } = data

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <PageBackLink href="/admin" label="Back to Admin" />
        <h1 className="text-3xl font-black italic tracking-tighter flex items-center text-red-500">
          <Database className="w-8 h-8 mr-3" /> SOURCE MAPPING
        </h1>
        <p className="text-slate-400">Open this only when OpenF1 cannot match a driver or circuit cleanly. Most weekends should not need manual reference work.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Drivers List */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold mb-4">Driver mapping</h2>
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
                  {drivers?.map((d) => (
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

        <div className="space-y-6">
          <AddDriverForm constructors={constructors || []} />
          <AddCircuitForm />
        </div>

      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Circuit mapping</h2>
        <div className="bg-card border border-white/5 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-400 text-sm">
                  <th className="p-4 font-bold">Circuit</th>
                  <th className="p-4 font-bold">City</th>
                  <th className="p-4 font-bold">Country</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {circuits?.length ? (
                  circuits.map((circuit) => (
                    <tr key={circuit.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-base text-slate-200">
                          {circuit.emoji ? `${circuit.emoji} ` : ''}
                          {circuit.name}
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{circuit.city || '—'}</td>
                      <td className="p-4 text-slate-300">{circuit.country || '—'}</td>
                      <td className="p-4">
                        <EditCircuitForm circuit={circuit} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 italic">
                      No circuits defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
