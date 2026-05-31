'use client'

import { usePathname } from 'next/navigation'
import { PendingLink } from '@/components/ui/pending-link'

type NavbarLinksProps = {
  links: Array<{
    href: string
    label: string
  }>
}

export function NavbarLinks({ links }: NavbarLinksProps) {
  const pathname = usePathname()

  return (
    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
      {links.map((link) => {
        const isPredictionRoute = pathname.startsWith('/race/') && pathname.endsWith('/predict')
        const isActive =
          pathname === link.href ||
          (link.href !== '/' && pathname.startsWith(`${link.href}/`)) ||
          (link.href === '/predictions' && isPredictionRoute)

        return (
          <PendingLink
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'border-red-500/35 bg-red-500/15 text-red-100'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            {link.label}
          </PendingLink>
        )
      })}
    </div>
  )
}
