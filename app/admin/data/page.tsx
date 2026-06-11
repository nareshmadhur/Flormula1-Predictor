'use client'

import { createClient } from '@/utils/supabase/client'
import { redirect } from 'next/navigation'
import { Database } from 'lucide-react'
import { ToggleDriverButton } from './toggle-driver-button'
import { DeleteDriverButton } from './delete-driver-button'
import { AddConstructorForm } from './add-constructor-form'
import { AddDriverForm } from './add-driver-form'
import { AddCircuitForm } from './add-circuit-form'
import { EditConstructorForm } from './edit-constructor-form'
import { DeleteConstructorButton } from './delete-constructor-button'
import { EditCircuitForm } from './edit-circuit-form'
import { CreateRaceForm } from '@/components/ui/create-race-form'
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
  driver_count?: number
  bonus_option_count?: number
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

type ConstructorReview = {
  hasCodeCollision: boolean
  hasNameCollision: boolean
  primaryId: string | null
  reviewStatus: 'ready' | 'keep' | 'review'
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

function normalizeConstructorKey(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function getConstructorUsageScore(constructorRow: Constructor) {
  return ((constructorRow.driver_count || 0) * 100) + (constructorRow.bonus_option_count || 0)
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
      const constructorsWithUsage = await Promise.all(
        ((constructors || []) as Constructor[]).map(async (constructorRow) => {
          const [driverUsage, bonusOptionUsage] = await Promise.all([
            supabase
              .from('drivers')
              .select('id', { count: 'exact', head: true })
              .eq('constructor_id', constructorRow.id),
            supabase
              .from('bonus_options')
              .select('id', { count: 'exact', head: true })
              .eq('constructor_id', constructorRow.id),
          ])

          return {
            ...constructorRow,
            driver_count: driverUsage.count || 0,
            bonus_option_count: bonusOptionUsage.count || 0,
          }
        })
      )

      setData({
        constructors: constructorsWithUsage,
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
  const constructorNameCounts = constructors.reduce((counts, constructorRow) => {
    const key = normalizeConstructorKey(constructorRow.name)
    counts.set(key, (counts.get(key) || 0) + 1)
    return counts
  }, new Map<string, number>())
  const constructorCodeCounts = constructors.reduce((counts, constructorRow) => {
    const key = normalizeConstructorKey(constructorRow.short_code)
    counts.set(key, (counts.get(key) || 0) + 1)
    return counts
  }, new Map<string, number>())
  const constructorReviewById = new Map<string, ConstructorReview>()

  constructors.forEach((constructorRow) => {
    const nameKey = normalizeConstructorKey(constructorRow.name)
    const codeKey = normalizeConstructorKey(constructorRow.short_code)
    const hasNameCollision = (constructorNameCounts.get(nameKey) || 0) > 1
    const hasCodeCollision = (constructorCodeCounts.get(codeKey) || 0) > 1
    const collisionRows = constructors
      .filter((candidate) => {
        const candidateNameKey = normalizeConstructorKey(candidate.name)
        const candidateCodeKey = normalizeConstructorKey(candidate.short_code)
        return (hasNameCollision && candidateNameKey === nameKey) || (hasCodeCollision && candidateCodeKey === codeKey)
      })
      .sort((left, right) => {
        const usageDelta = getConstructorUsageScore(right) - getConstructorUsageScore(left)
        if (usageDelta !== 0) return usageDelta
        const driverDelta = (right.driver_count || 0) - (left.driver_count || 0)
        if (driverDelta !== 0) return driverDelta
        const bonusDelta = (right.bonus_option_count || 0) - (left.bonus_option_count || 0)
        if (bonusDelta !== 0) return bonusDelta
        const emojiDelta = Number(Boolean(right.emoji)) - Number(Boolean(left.emoji))
        if (emojiDelta !== 0) return emojiDelta
        const nameLengthDelta = right.name.length - left.name.length
        if (nameLengthDelta !== 0) return nameLengthDelta
        return left.name.localeCompare(right.name)
      })
    const primaryId = collisionRows[0]?.id || null
    const hasCollision = hasNameCollision || hasCodeCollision

    constructorReviewById.set(constructorRow.id, {
      hasCodeCollision,
      hasNameCollision,
      primaryId,
      reviewStatus: !hasCollision ? 'ready' : primaryId === constructorRow.id ? 'keep' : 'review',
    })
  })

  const sortedConstructors = [...constructors].sort((left, right) => {
    const leftReview = constructorReviewById.get(left.id)
    const rightReview = constructorReviewById.get(right.id)
    const leftPriority = leftReview?.reviewStatus === 'review' ? 0 : leftReview?.reviewStatus === 'keep' ? 1 : 2
    const rightPriority = rightReview?.reviewStatus === 'review' ? 0 : rightReview?.reviewStatus === 'keep' ? 1 : 2

    if (leftPriority !== rightPriority) return leftPriority - rightPriority

    if (left.short_code !== right.short_code) {
      return left.short_code.localeCompare(right.short_code)
    }

    return left.name.localeCompare(right.name)
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <PageBackLink href="/admin" label="Back to Admin" />
        <h1 className="text-3xl font-black italic tracking-tighter flex items-center text-red-500">
          <Database className="w-8 h-8 mr-3" /> SOURCE MAPPING
        </h1>
        <p className="text-slate-400">Use this workspace for reference cleanup and the rare manual race fallback. Most weekends should still flow through schedule sync.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#manual-race" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10">
            Add race weekend
          </a>
          <a href="#constructor-mapping" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10">
            Constructors
          </a>
          <a href="#driver-mapping" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10">
            Drivers
          </a>
          <a href="#circuit-mapping" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10">
            Circuits
          </a>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Drivers List */}
        <div id="driver-mapping" className="md:col-span-2 space-y-4 scroll-mt-24">
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
          <div id="manual-race" className="scroll-mt-24">
            <CreateRaceForm circuits={circuits || []} />
          </div>
          <AddConstructorForm />
          <AddDriverForm constructors={constructors || []} />
          <AddCircuitForm />
        </div>

      </div>

      <div id="constructor-mapping" className="space-y-4 scroll-mt-24">
        <h2 className="text-xl font-bold">Constructor mapping</h2>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Safe cleanup: keep the row carrying live driver references first, then move bonus-only or empty duplicates off it before deleting them.
        </div>
        <div className="bg-card border border-white/5 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-400 text-sm">
                  <th className="p-4 font-bold">Constructor</th>
                  <th className="p-4 font-bold">Short Code</th>
                  <th className="p-4 font-bold">Used By</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {sortedConstructors.length ? (
                  sortedConstructors.map((constructorRow) => {
                    const review = constructorReviewById.get(constructorRow.id)
                    const driverCount = constructorRow.driver_count || 0
                    const bonusOptionCount = constructorRow.bonus_option_count || 0
                    const canDelete = driverCount === 0 && bonusOptionCount === 0
                    const deleteBlockReason = `Used by ${driverCount} driver${driverCount === 1 ? '' : 's'} and ${bonusOptionCount} bonus option${bonusOptionCount === 1 ? '' : 's'}.`

                    return (
                      <tr key={constructorRow.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-base text-slate-200">
                            {constructorRow.emoji ? `${constructorRow.emoji} ` : ''}
                            {constructorRow.name}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-red-500">{constructorRow.short_code}</td>
                        <td className="p-4 text-slate-300">
                          {driverCount} driver{driverCount === 1 ? '' : 's'} · {bonusOptionCount} bonus option{bonusOptionCount === 1 ? '' : 's'}
                        </td>
                        <td className="p-4">
                          <span className={`rounded-full border px-2 py-1 text-xs font-bold uppercase ${
                            review?.reviewStatus === 'review'
                              ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                              : review?.reviewStatus === 'keep'
                                ? 'border-sky-500/20 bg-sky-500/10 text-sky-200'
                                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                          }`}>
                            {review?.reviewStatus === 'review'
                              ? 'Review'
                              : review?.reviewStatus === 'keep'
                                ? 'Keep'
                                : 'Ready'}
                          </span>
                          {(review?.hasCodeCollision || review?.hasNameCollision) && (
                            <div className="mt-2 text-xs text-slate-500">
                              {review.hasCodeCollision && review.hasNameCollision
                                ? 'Shared name and code'
                                : review.hasCodeCollision
                                  ? 'Shared code'
                                  : 'Shared name'}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-start justify-end gap-2">
                            <EditConstructorForm constructor={constructorRow} />
                            <DeleteConstructorButton
                              id={constructorRow.id}
                              disabled={!canDelete}
                              reason={deleteBlockReason}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                      No constructors defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="circuit-mapping" className="space-y-4 scroll-mt-24">
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
