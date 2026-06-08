import { History } from 'lucide-react'
import { formatAmsterdamDateTime } from '@/utils/amsterdam-time'

export type BonusAuditEntry = {
  id: string
  action: string
  subject: string
  detail?: string | null
  changedAt: string
  changedBy?: string | null
}

type BonusAuditLogProps = {
  entries: BonusAuditEntry[]
}

function getActionLabel(action: string) {
  if (action === 'INSERT') return 'Added'
  if (action === 'UPDATE') return 'Updated'
  if (action === 'DELETE') return 'Deleted'
  if (action === 'ANSWERS') return 'Answers saved'
  return action
}

export function BonusAuditLog({ entries }: BonusAuditLogProps) {
  return (
    <details className="group rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            <History className="h-4 w-4" />
            History
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white">Bonus change history</h2>
          <p className="mt-1 text-sm text-slate-400">
            Recent question, option, and answer changes for this race.
          </p>
        </div>
      </summary>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/5 bg-black/20">
        {entries.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No bonus changes have been logged yet.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="border-b border-white/5 p-4 last:border-b-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">
                    {getActionLabel(entry.action)}
                  </div>
                  <div className="mt-1 break-words font-semibold text-white">{entry.subject}</div>
                  {entry.detail && (
                    <div className="mt-1 break-words text-sm text-slate-400">{entry.detail}</div>
                  )}
                </div>
                <div className="shrink-0 text-sm text-slate-500 sm:text-right">
                  <div>{formatAmsterdamDateTime(entry.changedAt, { includeZone: true }) || entry.changedAt}</div>
                  {entry.changedBy && <div>{entry.changedBy}</div>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </details>
  )
}
