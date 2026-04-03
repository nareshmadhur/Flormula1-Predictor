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
      <div className="space-y-1.5">
        {eyebrow && (
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
            {eyebrow}
          </div>
        )}
        <h2 className="text-2xl font-black italic tracking-tight text-white md:text-3xl">{title}</h2>
        {description && <p className="max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {aside}
    </div>
  )
}
