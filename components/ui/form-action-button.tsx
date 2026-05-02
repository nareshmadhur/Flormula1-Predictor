'use client'

import { useFormStatus } from 'react-dom'
import { RaceStartLights } from '@/components/ui/race-start-lights'

type FormActionButtonProps = {
  idleLabel: string
  pendingLabel?: string
  tone?: 'primary' | 'secondary' | 'light' | 'amber'
  className?: string
  disabled?: boolean
}

const toneClasses = {
  primary:
    'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:bg-red-500 disabled:bg-red-600/60',
  secondary:
    'bg-slate-700 text-white hover:bg-slate-600 disabled:bg-slate-700/60',
  light:
    'bg-slate-100 text-black hover:bg-white disabled:bg-slate-200',
  amber:
    'bg-amber-600 text-white hover:bg-amber-500 disabled:bg-amber-600/60',
} as const

export function FormActionButton({
  idleLabel,
  pendingLabel,
  tone = 'primary',
  className,
  disabled = false,
}: FormActionButtonProps) {
  const { pending } = useFormStatus()
  const isDisabled = disabled || pending

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-center font-bold leading-tight transition-colors disabled:cursor-not-allowed ${toneClasses[tone]} ${className || ''}`.trim()}
    >
      <span className="inline-flex min-w-0 items-center justify-center gap-2">
        {pending && <RaceStartLights className="scale-[0.55]" />}
        <span className="break-words">{pending ? pendingLabel || idleLabel : idleLabel}</span>
      </span>
    </button>
  )
}
