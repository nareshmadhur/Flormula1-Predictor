import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { signout } from '@/app/auth/actions'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
    profile = data
  }

  return (
    <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-1 flex-shrink-0">
            <span className="text-xl sm:text-2xl font-black italic tracking-tighter text-red-500">FLO-</span>
            <span className="text-xl sm:text-2xl font-black italic tracking-tighter text-slate-100">RMULA 1</span>
          </Link>
          
          <div className="flex items-center space-x-3 sm:space-x-6">
            <Link href="/leaderboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
              Leaderboard
            </Link>
            
            {user ? (
              <>
                <Link href="/predictions" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
                  Upcoming
                </Link>
                <Link href="/me/history" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
                  History
                </Link>
                <div className="flex items-center space-x-2 sm:space-x-4 ml-2 sm:ml-4">
                  <span className="text-xs sm:text-sm text-slate-400 font-bold truncate max-w-20 sm:max-w-none">{profile?.display_name || user.email}</span>
                  <form action={signout}>
                    <button type="submit" className="text-xs sm:text-sm font-medium text-red-400 hover:text-red-300 transition-colors touch-target">
                      Sign Out
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  Log in
                </Link>
                <Link href="/signup" className="text-xs sm:text-sm font-medium bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] touch-target">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
