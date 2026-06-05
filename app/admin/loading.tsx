import { AdminLoadingShell } from '@/components/ui/admin-loading-shell'

export default function Loading() {
  return (
    <AdminLoadingShell
      title="Loading admin"
      description="Checking access and opening the right admin workspace."
    />
  )
}
