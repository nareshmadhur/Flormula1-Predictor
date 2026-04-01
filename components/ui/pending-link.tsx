'use client'

import Link, { type LinkProps, useLinkStatus } from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { AnchorHTMLAttributes, MouseEvent, PropsWithChildren } from 'react'

type PendingLinkProps = PropsWithChildren<
  LinkProps &
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
>

function PendingIndicator({ launching }: { launching: boolean }) {
  const { pending } = useLinkStatus()

  if (!pending && !launching) return null

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <span className="race-link-overlay" />
    </span>
  )
}

export function PendingLink({
  children,
  className,
  onClick,
  target,
  ...props
}: PendingLinkProps) {
  const [launching, setLaunching] = useState(false)
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (launchTimerRef.current) {
        clearTimeout(launchTimerRef.current)
      }
    }
  }, [])

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === '_blank'
    ) {
      return
    }

    setLaunching(true)
    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current)
    }
    launchTimerRef.current = setTimeout(() => setLaunching(false), 520)
  }

  return (
    <Link
      aria-busy={undefined}
      className={`race-link-shell ${className || ''}`.trim()}
      onClick={handleClick}
      target={target}
      {...props}
    >
      <PendingIndicator launching={launching} />
      {children}
    </Link>
  )
}
