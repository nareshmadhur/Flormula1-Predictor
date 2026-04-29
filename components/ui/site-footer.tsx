import Link from 'next/link'

const footerLinks = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
]

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-white/10 bg-slate-950/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-black italic tracking-[-0.08em] text-slate-200">
            <span className="text-red-500">FLO</span>RMULA1
          </div>
          <nav className="flex flex-wrap gap-3">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium text-slate-400 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="max-w-4xl text-xs leading-5 text-slate-500">
          Flormula1 is a free Formula 1 fan scoreboard for private groups. It does not run betting, wagering,
          entry-fee contests, or cash prizes, and it is not affiliated with Formula 1, FIA, teams, or race organizers.
        </p>
      </div>
    </footer>
  )
}
