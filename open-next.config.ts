import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// The app is request-driven today, so it does not need an external cache
// binding to run on Workers. An R2-backed incremental cache can be added later
// if the app starts using ISR or cached fetches.
export default defineCloudflareConfig()
