type TenantContextBannerProps = {
  tenantName?: string | null
  label?: string
  className?: string
}

export function TenantContextBanner({
  tenantName,
  label = 'Tenant',
  className = '',
}: TenantContextBannerProps) {
  if (tenantName) {
    return (
      <div className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200 ${className}`.trim()}>
        {label}: {tenantName}
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300 ${className}`.trim()}>
      Your account is not assigned to a tenant yet. Ask an admin to complete tenant setup before using private competition pages.
    </div>
  )
}
