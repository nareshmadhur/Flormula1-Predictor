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
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-8 shadow-2xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/15 px-3 py-1 text-sm font-bold uppercase tracking-wider text-red-300">
              <UserRound className="h-4 w-4" /> Profile
            </div>
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter">YOUR PUBLIC NAME</h1>
              <p className="mt-2 max-w-2xl text-slate-300">
                Control how the app refers to you across the leaderboard, race recaps, and group views.
              </p>
            </div>
          </div>

          {tenantContext.tenantName ? (
            <TenantContextBanner tenantName={tenantContext.tenantName} label="Competing in" />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
              You can still update your profile before group setup is complete.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
        <section className="rounded-3xl border border-white/10 bg-card p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <IdCard className="h-6 w-6 text-red-500" />
            <div>
              <h2 className="text-2xl font-black italic tracking-tight">PROFILE SETTINGS</h2>
              <p className="text-sm text-slate-400">Keep your public identity current without touching your login email.</p>
            </div>
          </div>

          <ProfileForm
            defaultDisplayName={resolvedDisplayName}
            email={profile?.email || user.email || null}
          />
        </section>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-card p-8 shadow-xl">
          <div>
            <div className="text-sm font-bold uppercase tracking-widest text-slate-500">Current Name</div>
            <div className="mt-3 text-3xl font-black italic text-white">{resolvedDisplayName}</div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/25 p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Where it appears</div>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">Season and public leaderboards</div>
              <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">Scored race recaps and movement summaries</div>
              <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">Group operations and admin account management</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
