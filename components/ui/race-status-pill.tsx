import type { RaceStatus } from '@/utils/race-status'
import { getRaceStatusLabel, getRaceTone, getRaceToneClasses } from '@/utils/race-experience'

type RaceStatusPillProps = {
  status: RaceStatus
  label?: string
  size?: 'xs' | 'sm'
  className?: string
}

export function RaceStatusPill({
  status,
  label,
  size = 'sm',
  className = '',
}: RaceStatusPillProps) {
  const tone = getRaceTone(status)
  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-1 text-[11px] tracking-[0.18em]'
      : 'px-2.5 py-1 text-xs tracking-[0.18em]'

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase ${sizeClasses} ${getRaceToneClasses(
        tone
      )} ${className}`.trim()}
    >
      {label || getRaceStatusLabel(status)}
    </span>
  )
}
