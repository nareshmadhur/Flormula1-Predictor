import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

function isSupabaseTrafficPaused() {
  return process.env.SUPABASE_TRAFFIC_PAUSED === 'true'
}

function maintenanceResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Temporarily unavailable</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #08090d;
        color: #f8fafc;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(32rem, calc(100% - 2rem));
        padding: 2rem;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 1rem;
        background: #11131a;
      }
      p {
        color: #94a3b8;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Temporarily unavailable</h1>
      <p>We are doing short maintenance and will be back soon.</p>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '300',
      },
    }
  )
}

export async function proxy(request: NextRequest) {
  if (isSupabaseTrafficPaused()) {
    return maintenanceResponse()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
