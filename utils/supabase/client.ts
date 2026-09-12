import { createBrowserClient } from '@supabase/ssr'
import { fetchWithTimeout } from '@/utils/supabase/fetch'

let autoRefreshStopped: Promise<void> | null = null

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithTimeout,
      },
    }
  )

  if (typeof window !== 'undefined' && !autoRefreshStopped) {
    autoRefreshStopped = client.auth
      .initialize()
      .then(() => client.auth.stopAutoRefresh())
      .catch(() => undefined)
  }

  return client
}
