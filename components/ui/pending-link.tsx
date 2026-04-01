'use client'

import Link, { type LinkProps, useLinkStatus } from 'next/link'
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
      className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${
        pending ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <span className="race-link-track">
        <span className="race-link-car" />
      </span>
    </span>
  )
}

export function PendingLink({
  children,
  className,
  ...props
}: PendingLinkProps) {
  return (
    <Link
      aria-busy={undefined}
      className={`race-link-shell ${className || ''}`}
      {...props}
    >
      <PendingIndicator />
      {children}
    </Link>
  )
}
