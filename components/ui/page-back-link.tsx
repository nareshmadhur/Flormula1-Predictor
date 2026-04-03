'use client'

import { ArrowLeft } from 'lucide-react'
import { PendingLink } from '@/components/ui/pending-link'

type PageBackLinkProps = {
  href: string
  label: string
}

export function PageBackLink({ href, label }: PageBackLinkProps) {
  return (
    <PendingLink
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </PendingLink>
  )
}
