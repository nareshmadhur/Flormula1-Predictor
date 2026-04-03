import type { LucideIcon } from 'lucide-react'

type RaceMetaItem = {
  label?: string
  value: string
  icon?: LucideIcon
  tone?: 'default' | 'open' | 'pending' | 'scored' | 'cancelled'
}

type RaceMetaStripProps = {
  items: RaceMetaItem[]
  className?: string
}

function getToneClasses(tone: RaceMetaItem['tone']) {
  if (tone === 'open') return 'border-red-500/20 bg-red-500/10 text-red-100'
  if (tone === 'pending') return 'border-amber-500/20 bg-amber-500/10 text-amber-100'
  if (tone === 'scored') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
  if (tone === 'cancelled') return 'border-red-500/20 bg-red-500/10 text-red-200'
  return 'border-white/10 bg-black/20 text-slate-300'
}

export function RaceMetaStrip({ items, className = '' }: RaceMetaStripProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {items.map((item, index) => {
        const Icon = item.icon

        return (
          <span
            key={`${item.label || item.value}-${index}`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${getToneClasses(
              item.tone
            )}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />}
            {item.label && (
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-current/75">
                {item.label}
              </span>
            )}
            <span className="font-medium leading-none">{item.value}</span>
          </span>
        )
      })}
    </div>
  )
}
