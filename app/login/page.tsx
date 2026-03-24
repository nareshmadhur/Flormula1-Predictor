import { login } from '@/app/auth/actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error: string }
}) {
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
      <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-black italic tracking-tighter mb-6 text-center">WELCOME BACK</h1>
        
        <form className="flex-1 flex flex-col w-full justify-center gap-4 text-foreground" action={login}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              name="email"
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
            Sign In
          </button>
          
          {searchParams?.error && (
            <p className="mt-4 p-4 bg-red-500/10 text-red-400 text-center rounded-xl border border-red-500/20">
              {searchParams.error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
