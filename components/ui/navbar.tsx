import { createClient } from '@/utils/supabase/server'
import { signout } from '@/app/auth/actions'
import { getUserTenantContext } from '@/utils/tenant'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getProfileDisplayName } from '@/utils/profile-name'
import { PendingLink } from '@/components/ui/pending-link'
import { SignOutButton } from '@/components/ui/signout-button'
import { ChevronDown } from 'lucide-react'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let tenantName: string | null = null
  let isAdmin = false
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .single()
    profile = data

    const tenantContext = await getUserTenantContext(supabase, user.id)
    tenantName = tenantContext.tenantName
    const adminAccess = await getAdminAccessContext(supabase)
    isAdmin = adminAccess?.isAdmin ?? false
  }

  const primaryLinks = [{ href: '/leaderboard', label: 'Leaderboard' }]

  if (user) {
    primaryLinks.push(
      { href: '/predictions', label: 'Upcoming' },
      { href: '/me/history', label: 'History' }
    )

    if (isAdmin) {
      primaryLinks.push({ href: '/admin', label: 'Admin' })
    }
  }

  return (
    <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <PendingLink href="/" className="flex items-center space-x-1 flex-shrink-0">
            <span className="text-xl sm:text-2xl font-black italic tracking-tighter text-red-500">FLO-</span>
            <span className="text-xl sm:text-2xl font-black italic tracking-tighter text-slate-100">RMULA 1</span>
          </PendingLink>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            {user ? (
              <>
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10 sm:text-sm [&::-webkit-details-marker]:hidden">
                    <span className="truncate max-w-28 sm:max-w-44">
                      {getProfileDisplayName(profile?.display_name, user.email, 'Profile')}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </summary>

                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
                    <div className="border-b border-white/10 px-3 pb-3">
                      <div className="truncate text-sm font-bold text-white">
                        {getProfileDisplayName(profile?.display_name, user.email, 'Profile')}
                      </div>
                      {tenantName && (
                        <div className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-400">
                          Group: {tenantName}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <PendingLink
                        href="/me/profile"
                        className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                      >
                        Profile
                      </PendingLink>
                      <form action={signout} className="rounded-xl px-3 py-2 hover:bg-white/10">
                        <SignOutButton />
                      </form>
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <div className="flex items-center space-x-2 sm:space-x-4">
                <PendingLink href="/login" className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  Log in
                </PendingLink>
                <PendingLink href="/signup" className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] touch-target">
                  Sign up
                </PendingLink>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
          {primaryLinks.map((link) => (
            <PendingLink
              key={link.href}
              href={link.href}
              className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </PendingLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
