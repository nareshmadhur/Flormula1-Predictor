'use client'

import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'

export type ReferenceOptionPickerOption = {
  id: string
  primary: string
  secondary?: string
  searchText?: string
}

type ReferenceOptionPickerProps = {
  name: string
  options: ReferenceOptionPickerOption[]
  searchPlaceholder: string
}

export function ReferenceOptionPicker({
  name,
  options,
  searchPlaceholder,
}: ReferenceOptionPickerProps) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return options

    return options.filter((option) =>
      `${option.primary} ${option.secondary || ''} ${option.searchText || ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [options, query])

  const filteredIds = useMemo(() => filteredOptions.map((option) => option.id), [filteredOptions])
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((optionId) => selectedIdSet.has(optionId))

  function toggleOption(optionId: string) {
    setSelectedIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
    )
  }

  function selectFilteredOptions() {
    setSelectedIds((current) => {
      const next = new Set(current)
      filteredIds.forEach((optionId) => next.add(optionId))
      return Array.from(next)
    })
  }

  function clearFilteredOptions() {
    const filteredIdSet = new Set(filteredIds)
    setSelectedIds((current) => current.filter((optionId) => !filteredIdSet.has(optionId)))
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block lg:max-w-xs lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-white/10 bg-black/35 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={selectFilteredOptions}
            disabled={filteredIds.length === 0 || allFilteredSelected}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {query.trim() ? 'Select filtered' : 'Select all'}
          </button>
          <button
            type="button"
            onClick={clearFilteredOptions}
            disabled={selectedIds.length === 0 || filteredIds.length === 0}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {filteredOptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-500">
          No matches.
        </div>
      ) : (
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filteredOptions.map((option) => {
            const isSelected = selectedIdSet.has(option.id)

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleOption(option.id)}
                className={`flex min-h-16 items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'border-red-400/50 bg-red-500/10 text-white'
                    : 'border-white/5 bg-black/25 text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <span className="min-w-0">
                  <span className="block break-words font-semibold">{option.primary}</span>
                  {option.secondary ? (
                    <span className="mt-0.5 block break-words text-xs text-slate-500">
                      {option.secondary}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? 'border-red-300/60 bg-red-400/20 text-red-100'
                      : 'border-white/10 text-slate-600'
                  }`}
                >
                  {isSelected ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {selectedIds.map((optionId) => (
        <input key={optionId} type="hidden" name={name} value={optionId} />
      ))}
    </div>
  )
}
