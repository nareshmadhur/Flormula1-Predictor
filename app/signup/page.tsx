import { signup } from '@/app/auth/actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string; message?: string }>
}) {
  const params = await searchParams
  
  if (params.message) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
        <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl text-center">
          <h1 className="text-3xl font-black italic tracking-tighter mb-4 text-green-500">CHECK YOUR EMAIL</h1>
          <p className="text-lg text-slate-300 mb-4">
            We've sent a confirmation link to your inbox.
          </p>
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-blue-300 text-sm mb-6 text-left">
            <p className="font-bold mb-1 flex items-center">
              <span className="mr-2 text-xl">⚠️</span> Important:
            </p>
            Please check your <strong>Spam</strong> or <strong>Junk</strong> folder if you don't see it. 
            <br/><br/>
            The email will be from <span className="font-bold text-white">Supabase</span>.
          </div>
          <p className="text-slate-400 text-sm">
            Once confirmed, you can <a href="/login" className="text-red-500 hover:text-red-400 font-bold hover:underline transition-colors">sign in here</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
      <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-black italic tracking-tighter mb-6 text-center">JOIN THE GRID</h1>
        
        <form className="flex-1 flex flex-col w-full justify-center gap-4 text-foreground" action={signup}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="display_name">
              Display Name
            </label>
            <input
              className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              name="display_name"
              placeholder="Your public predictor name"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl px-4 py-3 mt-4 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            Sign Up
          </button>
          
          {params?.error && (
            <p className="mt-4 p-4 bg-red-500/10 text-red-400 text-center rounded-xl border border-red-500/20">
              {params.error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
