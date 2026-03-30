'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createTenant } from '@/app/actions/admin-data'
import { initialTenantAdminActionState } from './action-state'

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
    >
      {pending ? 'Creating Tenant...' : 'Create Tenant'}
    </button>
  )
}

export function CreateTenantForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    createTenant,
    initialTenantAdminActionState
  )

  useEffect(() => {
    if (state.status !== 'success') return
    formRef.current?.reset()
    router.refresh()
  }, [router, state.status])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-400">Tenant Name</label>
        <input
          name="name"
          required
          placeholder="Example: Amsterdam Office Pool"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-400">Slug</label>
        <input
          name="slug"
          required
          placeholder="amsterdam-office-pool"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base"
        />
      </div>
      <SubmitButton pending={pending} />
      {state.message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            state.status === 'success'
              ? 'border border-green-500/20 bg-green-500/10 text-green-300'
              : 'border border-red-500/20 bg-red-500/10 text-red-300'
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  )
}
