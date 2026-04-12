import type { Metadata } from 'next'
import { getAbsoluteUrl } from '@/utils/site'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Privacy information for Flormula1 users and group organizers.',
  alternates: {
    canonical: getAbsoluteUrl('/privacy'),
  },
}

export default function PrivacyPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-[2rem] border border-white/10 bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-red-400">
          Trust
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">Privacy</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          A plain-language overview of how Flormula1 uses data to run private prediction groups.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Data we use</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Account email, display name, group membership, prediction entries, scoring history, and basic
            account activity needed to run the game.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Why we use it</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            To sign you in, place you in the right group, save your picks, calculate standings, and keep
            the game fair for everyone playing.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Trusted services</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Flormula1 uses trusted services for sign-in, hosting, app data, and race-weekend timing so the
            product stays reliable through the season.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">User control</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            You can update your public display name in your profile. For account or data questions, contact
            support from the footer.
          </p>
        </div>
      </section>
      <p className="text-xs leading-5 text-slate-500">
        For privacy questions, use the contact link in the footer.
      </p>
    </div>
  )
}
