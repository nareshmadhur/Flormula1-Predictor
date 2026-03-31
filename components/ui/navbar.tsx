import { createClient } from '@/utils/supabase/server'
import { signout } from '@/app/auth/actions'
import { getUserTenantContext } from '@/utils/tenant'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getProfileDisplayName } from '@/utils/profile-name'
import { PendingLink } from '@/components/ui/pending-link'
import { SignOutButton } from '@/components/ui/signout-button'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let tenantName: string | null = null
  let isPlatformAdmin = false
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
    isPlatformAdmin = adminAccess?.isPlatformAdmin ?? false
  }

  const primaryLinks = [{ href: '/leaderboard', label: 'Leaderboard' }]

  if (user) {
    primaryLinks.push(
      { href: '/predictions', label: 'Upcoming' },
      { href: '/me/history', label: 'History' }
    )

    if (isPlatformAdmin) {
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
                <div className="flex items-center space-x-2 sm:space-x-3">
                  {tenantName && (
                    <span className="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 sm:inline-flex">
                      {tenantName}
                    </span>
                  )}
                  <span className="text-xs sm:text-sm text-slate-400 font-bold truncate max-w-24 sm:max-w-48">
                    {getProfileDisplayName(profile?.display_name, user.email, 'Profile')}
                  </span>
                  <form action={signout}>
                    <SignOutButton />
                  </form>
                </div>
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
