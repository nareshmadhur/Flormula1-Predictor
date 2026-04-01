import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { IdCard, UserRound } from 'lucide-react'
import { getProfileDisplayName } from '@/utils/profile-name'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
import { ProfileForm } from './profile-form'

export const revalidate = 0

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, tenantContext] = await Promise.all([
    supabase.from('profiles').select('display_name, email').eq('id', user.id).single(),
    getUserTenantContext(supabase, user.id),
  ])

  const resolvedDisplayName = getProfileDisplayName(
    profile?.display_name,
    profile?.email || user.email,
    'Profile'
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-6 shadow-2xl md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-red-300">
              <UserRound className="h-4 w-4" /> Profile
            </div>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter md:text-4xl">Your public name</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Update how you appear across standings, race recaps, and group views.
              </p>
            </div>
          </div>

          {tenantContext.tenantName ? (
            <TenantContextBanner tenantName={tenantContext.tenantName} label="Playing in" />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
              You can update your name before group setup is finished.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-xl md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <IdCard className="h-6 w-6 text-red-500" />
            <div>
              <h2 className="text-2xl font-black italic tracking-tight">Profile settings</h2>
              <p className="text-sm text-slate-400">Change your public name without touching your login email.</p>
            </div>
          </div>

          <ProfileForm
            defaultDisplayName={resolvedDisplayName}
            email={profile?.email || user.email || null}
          />
        </section>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-card p-6 shadow-xl md:p-8">
          <div>
            <div className="text-sm font-bold uppercase tracking-widest text-slate-500">Current name</div>
            <div className="mt-3 text-3xl font-black italic text-white">{resolvedDisplayName}</div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/25 p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Shows up in</div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
              <div className="rounded-full border border-white/5 bg-white/5 px-3 py-2">Standings</div>
              <div className="rounded-full border border-white/5 bg-white/5 px-3 py-2">Race recaps</div>
              <div className="rounded-full border border-white/5 bg-white/5 px-3 py-2">Group admin views</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
