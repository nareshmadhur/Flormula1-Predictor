type RaceStartLightsProps = {
  className?: string
  variant?: 'submit' | 'loading'
}

export function RaceStartLights({ className, variant = 'submit' }: RaceStartLightsProps) {
  return (
    <span
      aria-hidden="true"
      className={`race-start-lights ${
        variant === 'loading' ? 'race-start-lights-loading' : 'race-start-lights-submit'
      } ${className || ''}`.trim()}
    >
      <span className="race-start-light" />
      <span className="race-start-light" />
      <span className="race-start-light" />
      <span className="race-start-light" />
      <span className="race-start-light" />
    </span>
  )
}
