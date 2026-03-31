'use client'

import Link, { type LinkProps, useLinkStatus } from 'next/link'
import { LoaderCircle } from 'lucide-react'
import type { AnchorHTMLAttributes, PropsWithChildren } from 'react'

type PendingLinkProps = PropsWithChildren<
  LinkProps &
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
>

function PendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-4 w-4 items-center justify-center transition-opacity duration-150 ${
        pending ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
    </span>
  )
}

export function PendingLink({
  children,
  className,
  ...props
}: PendingLinkProps) {
  return (
    <Link className={className} {...props}>
      {children}
      <PendingIndicator />
    </Link>
  )
}
