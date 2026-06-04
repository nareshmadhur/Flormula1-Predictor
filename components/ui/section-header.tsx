import type { ReactNode } from 'react'

type SectionHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  aside?: ReactNode
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 md:flex-row md:items-end md:justify-between ${className}`.trim()}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <div className="break-words text-xs font-bold uppercase tracking-[0.16em] text-slate-500 sm:tracking-[0.18em]">
            {eyebrow}
          </div>
        )}
        <h2 className="break-words text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
        {description && <p className="max-w-2xl break-words text-sm text-slate-400">{description}</p>}
      </div>
      {aside}
    </div>
  )
}
