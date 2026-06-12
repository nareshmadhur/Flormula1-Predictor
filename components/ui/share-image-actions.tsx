'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, Loader2, Share2 } from 'lucide-react'

type StandingsShareEntry = {
  rank: number
  name: string
  points: number
  exactHits: number
  highlight?: boolean
}

type RaceResultShareEntry = {
  rank: number
  name: string
  points: number
  highlight?: boolean
}

type RacePodiumEntry = {
  slot: string
  value: string
}

export type StandingsShareCardData = {
  kind: 'standings'
  season: number
  title: string
  subtitle: string
  caption: string
  footer: string
  entries: StandingsShareEntry[]
}

export type RaceResultShareCardData = {
  kind: 'race-result'
  season: number
  title: string
  subtitle: string
  headline: string
  detail: string
  footer: string
  podium: RacePodiumEntry[]
  scorers: RaceResultShareEntry[]
}

type ShareCardData = StandingsShareCardData | RaceResultShareCardData

type ShareImageActionsProps = {
  title: string
  description: string
  fileName: string
  data: ShareCardData
}

type StatusTone = 'success' | 'error' | 'info'

type StatusMessage = {
  tone: StatusTone
  text: string
}

type ActiveAction = 'copy' | 'download' | 'share' | null

const cardWidth = 1200
const cardHeight = 1500

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function wrapText(value: string, maxCharsPerLine: number, maxLines: number) {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      lines.push(truncateText(word, maxCharsPerLine))
      currentLine = ''
    }

    if (lines.length === maxLines) {
      break
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine)
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines)
  }

  if (words.length > 0 && lines.length === maxLines) {
    const consumed = lines.join(' ').length
    if (consumed < value.trim().length) {
      lines[maxLines - 1] = truncateText(lines[maxLines - 1], maxCharsPerLine - 1)
    }
  }

  return lines
}

function renderTitleLines(lines: string[], x: number, startY: number) {
  return lines
    .map(
      (line, index) => `
        <text
          x="${x}"
          y="${startY + index * 72}"
          fill="#F8FAFC"
          font-family="Inter, ui-sans-serif, system-ui, sans-serif"
          font-size="62"
          font-style="italic"
          font-weight="900"
          letter-spacing="-1.8"
        >
          ${escapeXml(line)}
        </text>
      `
    )
    .join('')
}

function renderBackgroundDecor() {
  return `
    <rect width="${cardWidth}" height="${cardHeight}" fill="url(#bg)" />
    <rect width="${cardWidth}" height="${cardHeight}" fill="url(#grid)" opacity="0.18" />
    <path d="M-120 1180 L1320 620" stroke="rgba(239,68,68,0.18)" stroke-width="120" />
    <path d="M-80 1330 L1360 770" stroke="rgba(14,165,233,0.08)" stroke-width="80" />
    <circle cx="1070" cy="200" r="170" fill="rgba(239,68,68,0.12)" />
    <circle cx="1030" cy="240" r="110" fill="rgba(255,255,255,0.05)" />
  `
}

function renderShell() {
  return `
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="42%" stop-color="#0F172A" />
        <stop offset="100%" stop-color="#111827" />
      </linearGradient>
      <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
        <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1" />
      </pattern>
      <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(15,23,42,0.92)" />
        <stop offset="100%" stop-color="rgba(2,6,23,0.9)" />
      </linearGradient>
      <linearGradient id="accentPanel" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(239,68,68,0.24)" />
        <stop offset="100%" stop-color="rgba(239,68,68,0.1)" />
      </linearGradient>
    </defs>
  `
}

function renderStandingsCard(data: StandingsShareCardData) {
  const titleLines = wrapText(data.title, 16, 2)
  const titleBaseY = 262
  const titleBottomY = titleBaseY + (titleLines.length - 1) * 72
  const listTop = 450
  const rowHeight = 116
  const maxEntries = Math.min(5, data.entries.length)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
      ${renderShell()}
      ${renderBackgroundDecor()}

      <text
        x="76"
        y="102"
        fill="#F8FAFC"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="36"
        font-style="italic"
        font-weight="900"
        letter-spacing="-1.5"
      >
        FLORMULA1
      </text>

      <rect x="76" y="126" width="150" height="42" rx="21" fill="rgba(239,68,68,0.16)" stroke="rgba(248,113,113,0.4)" />
      <text
        x="151"
        y="154"
        text-anchor="middle"
        fill="#FCA5A5"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="18"
        font-weight="800"
        letter-spacing="1.4"
      >
        SEASON ${data.season}
      </text>

      <rect x="246" y="126" width="220" height="42" rx="21" fill="rgba(15,23,42,0.65)" stroke="rgba(255,255,255,0.12)" />
      <text
        x="356"
        y="154"
        text-anchor="middle"
        fill="#CBD5E1"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="18"
        font-weight="700"
        letter-spacing="1.2"
      >
        ${escapeXml(data.caption.toUpperCase())}
      </text>

      ${renderTitleLines(titleLines, 76, titleBaseY)}

      <text
        x="76"
        y="${titleBottomY + 52}"
        fill="#94A3B8"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="28"
        font-weight="600"
      >
        ${escapeXml(data.subtitle)}
      </text>

      <rect x="76" y="${listTop - 28}" width="1048" height="772" rx="42" fill="url(#panel)" stroke="rgba(255,255,255,0.1)" />

      <text x="118" y="${listTop + 18}" fill="#64748B" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="2.2">RANK</text>
      <text x="232" y="${listTop + 18}" fill="#64748B" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="2.2">PLAYER</text>
      <text x="896" y="${listTop + 18}" fill="#64748B" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="2.2" text-anchor="end">EXACT</text>
      <text x="1040" y="${listTop + 18}" fill="#64748B" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="2.2" text-anchor="end">POINTS</text>

      ${data.entries
        .slice(0, maxEntries)
        .map((entry, index) => {
          const y = listTop + 44 + index * rowHeight
          const rowFill = entry.rank === 1 ? 'rgba(250,204,21,0.12)' : entry.highlight ? 'url(#accentPanel)' : 'rgba(255,255,255,0.03)'
          const rowStroke = entry.rank === 1 ? 'rgba(250,204,21,0.3)' : entry.highlight ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.08)'

          return `
            <rect x="104" y="${y}" width="992" height="92" rx="28" fill="${rowFill}" stroke="${rowStroke}" />
            <rect x="128" y="${y + 16}" width="60" height="60" rx="18" fill="rgba(2,6,23,0.7)" stroke="rgba(255,255,255,0.1)" />
            <text x="158" y="${y + 56}" text-anchor="middle" fill="#F8FAFC" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="28" font-style="italic" font-weight="900">${entry.rank}</text>
            <text x="220" y="${y + 44}" fill="#F8FAFC" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="30" font-weight="800">${escapeXml(truncateText(entry.name, 26))}</text>
            <text x="220" y="${y + 70}" fill="#94A3B8" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="600">${entry.exactHits} exact hit${entry.exactHits === 1 ? '' : 's'}</text>
            <text x="896" y="${y + 56}" text-anchor="end" fill="#E2E8F0" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="26" font-weight="800">${entry.exactHits}</text>
            <text x="1040" y="${y + 56}" text-anchor="end" fill="#F87171" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="36" font-style="italic" font-weight="900">${entry.points}</text>
          `
        })
        .join('')}

      <rect x="76" y="1258" width="1048" height="136" rx="34" fill="rgba(2,6,23,0.74)" stroke="rgba(255,255,255,0.08)" />
      <text x="118" y="1312" fill="#FCA5A5" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="1.8">SHARE SNAPSHOT</text>
      <text x="118" y="1354" fill="#E2E8F0" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="700">${escapeXml(truncateText(data.footer, 54))}</text>
    </svg>
  `
}

function renderRaceResultCard(data: RaceResultShareCardData) {
  const titleLines = wrapText(data.title, 17, 2)
  const detailLines = wrapText(data.detail, 42, 2)
  const titleBaseY = 262
  const titleBottomY = titleBaseY + (titleLines.length - 1) * 72

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
      ${renderShell()}
      ${renderBackgroundDecor()}

      <text
        x="76"
        y="102"
        fill="#F8FAFC"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="36"
        font-style="italic"
        font-weight="900"
        letter-spacing="-1.5"
      >
        FLORMULA1
      </text>

      <rect x="76" y="126" width="150" height="42" rx="21" fill="rgba(239,68,68,0.16)" stroke="rgba(248,113,113,0.4)" />
      <text
        x="151"
        y="154"
        text-anchor="middle"
        fill="#FCA5A5"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="18"
        font-weight="800"
        letter-spacing="1.4"
      >
        SEASON ${data.season}
      </text>

      <rect x="246" y="126" width="250" height="42" rx="21" fill="rgba(15,23,42,0.65)" stroke="rgba(255,255,255,0.12)" />
      <text
        x="371"
        y="154"
        text-anchor="middle"
        fill="#CBD5E1"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="18"
        font-weight="700"
        letter-spacing="1.2"
      >
        ${escapeXml(data.subtitle.toUpperCase())}
      </text>

      ${renderTitleLines(titleLines, 76, titleBaseY)}

      <text
        x="76"
        y="${titleBottomY + 56}"
        fill="#F87171"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="38"
        font-style="italic"
        font-weight="900"
      >
        ${escapeXml(truncateText(data.headline, 42))}
      </text>

      ${detailLines
        .map(
          (line, index) => `
            <text
              x="76"
              y="${titleBottomY + 106 + index * 30}"
              fill="#94A3B8"
              font-family="Inter, ui-sans-serif, system-ui, sans-serif"
              font-size="24"
              font-weight="600"
            >
              ${escapeXml(line)}
            </text>
          `
        )
        .join('')}

      <rect x="76" y="500" width="500" height="720" rx="40" fill="url(#panel)" stroke="rgba(255,255,255,0.1)" />
      <text x="118" y="564" fill="#FCA5A5" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="800" letter-spacing="2.2">OFFICIAL PODIUM</text>

      ${data.podium
        .slice(0, 3)
        .map((entry, index) => {
          const y = 604 + index * 176
          const rowFill = index === 0 ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.03)'
          const rowStroke = index === 0 ? 'rgba(250,204,21,0.28)' : 'rgba(255,255,255,0.08)'
          const valueLines = wrapText(entry.value, 20, 2)

          return `
            <rect x="108" y="${y}" width="436" height="144" rx="30" fill="${rowFill}" stroke="${rowStroke}" />
            <rect x="132" y="${y + 22}" width="64" height="64" rx="18" fill="rgba(2,6,23,0.72)" stroke="rgba(255,255,255,0.1)" />
            <text x="164" y="${y + 64}" text-anchor="middle" fill="#F8FAFC" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="26" font-style="italic" font-weight="900">${escapeXml(entry.slot)}</text>
            ${valueLines
              .map(
                (line, lineIndex) => `
                  <text x="220" y="${y + 58 + lineIndex * 34}" fill="#F8FAFC" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="800">${escapeXml(line)}</text>
                `
              )
              .join('')}
            ${
              index === 0
                ? `<text x="220" y="${y + 110}" fill="#FDE68A" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="1.6">WINNER</text>`
                : ''
            }
          `
        })
        .join('')}

      <rect x="624" y="500" width="500" height="720" rx="40" fill="url(#panel)" stroke="rgba(255,255,255,0.1)" />
      <text x="666" y="564" fill="#93C5FD" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="800" letter-spacing="2.2">TOP SCORERS</text>

      ${data.scorers
        .slice(0, 5)
        .map((entry, index) => {
          const y = 604 + index * 120
          const rowFill = entry.rank === 1 ? 'rgba(59,130,246,0.14)' : entry.highlight ? 'url(#accentPanel)' : 'rgba(255,255,255,0.03)'
          const rowStroke = entry.rank === 1 ? 'rgba(147,197,253,0.25)' : entry.highlight ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.08)'

          return `
            <rect x="656" y="${y}" width="436" height="92" rx="28" fill="${rowFill}" stroke="${rowStroke}" />
            <rect x="680" y="${y + 16}" width="56" height="56" rx="16" fill="rgba(2,6,23,0.72)" stroke="rgba(255,255,255,0.1)" />
            <text x="708" y="${y + 54}" text-anchor="middle" fill="#F8FAFC" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="24" font-style="italic" font-weight="900">${entry.rank}</text>
            <text x="762" y="${y + 44}" fill="#F8FAFC" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="800">${escapeXml(truncateText(entry.name, 22))}</text>
            <text x="1048" y="${y + 54}" text-anchor="end" fill="#F87171" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="34" font-style="italic" font-weight="900">${entry.points}</text>
          `
        })
        .join('')}

      <rect x="76" y="1260" width="1048" height="134" rx="34" fill="rgba(2,6,23,0.74)" stroke="rgba(255,255,255,0.08)" />
      <text x="118" y="1312" fill="#FCA5A5" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="1.8">RACE SNAPSHOT</text>
      <text x="118" y="1354" fill="#E2E8F0" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="700">${escapeXml(truncateText(data.footer, 54))}</text>
    </svg>
  `
}

function buildSvg(data: ShareCardData) {
  if (data.kind === 'standings') {
    return renderStandingsCard(data)
  }

  return renderRaceResultCard(data)
}

async function svgToBlob(data: ShareCardData) {
  const svg = buildSvg(data)
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Share image could not be rendered.'))
      nextImage.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = cardWidth
    canvas.height = cardHeight

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas is not available in this browser.')
    }

    context.drawImage(image, 0, 0, cardWidth, cardHeight)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png')
    })

    if (!blob) {
      throw new Error('PNG export is not available in this browser.')
    }

    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function getStatusClasses(tone: StatusTone) {
  if (tone === 'success') {
    return 'border-green-500/20 bg-green-500/10 text-green-200'
  }

  if (tone === 'error') {
    return 'border-red-500/20 bg-red-500/10 text-red-200'
  }

  return 'border-white/10 bg-black/30 text-slate-300'
}

function getClipboardErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'This browser blocked image clipboard access. Use Share or Download PNG instead.'
  }

  if (error instanceof Error && error.message.toLowerCase().includes('permission denied')) {
    return 'This browser blocked image clipboard access. Use Share or Download PNG instead.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'The share image could not be copied.'
}

export function ShareImageActions({ title, description, fileName, data }: ShareImageActionsProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [supportsNativeShare, setSupportsNativeShare] = useState(false)
  const actionInFlightRef = useRef(false)

  useEffect(() => {
    setSupportsNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!status) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setStatus(null)
    }, status.tone === 'error' ? 5200 : 3600)

    return () => window.clearTimeout(timeoutId)
  }, [status])

  const runAction = async (action: Exclude<ActiveAction, null>, handler: () => Promise<void>) => {
    if (actionInFlightRef.current) {
      return
    }

    actionInFlightRef.current = true
    setActiveAction(action)
    setStatus(null)

    try {
      await handler()
    } finally {
      actionInFlightRef.current = false
      setActiveAction(null)
    }
  }

  const copyImage = async () => {
    await runAction('copy', async () => {
      try {
        const blob = await svgToBlob(data)

        if (!navigator.clipboard?.write || typeof window.ClipboardItem === 'undefined') {
          setStatus({
            tone: 'info',
            text: 'Image clipboard support is not available here. Use Share or Download PNG instead.',
          })
          return
        }

        await navigator.clipboard.write([
          new window.ClipboardItem(
            {
              [blob.type]: Promise.resolve(blob),
            },
            { presentationStyle: 'inline' }
          ),
        ])

        setStatus({
          tone: 'success',
          text: 'Share image copied. Paste it straight into Messages, WhatsApp, Instagram, or Slack.',
        })
      } catch (error) {
        setStatus({
          tone: 'info',
          text: getClipboardErrorMessage(error),
        })
      }
    })
  }

  const downloadImage = async () => {
    await runAction('download', async () => {
      try {
        const blob = await svgToBlob(data)
        downloadBlob(blob, fileName)
        setStatus({
          tone: 'success',
          text: 'PNG downloaded. You can drop it into any chat or social composer.',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The share image could not be downloaded.'
        setStatus({
          tone: 'error',
          text: message,
        })
      }
    })
  }

  const shareImage = async () => {
    await runAction('share', async () => {
      try {
        if (typeof navigator.share !== 'function') {
          setStatus({
            tone: 'info',
            text: 'Native sharing is not available in this browser. Try Copy image or Download PNG instead.',
          })
          return
        }

        const blob = await svgToBlob(data)
        const file = new File([blob], fileName, { type: 'image/png' })

        if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
          setStatus({
            tone: 'info',
            text: 'This browser can share links, but not image files. Download the PNG instead.',
          })
          return
        }

        await navigator.share({
          title,
          text: description,
          files: [file],
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus({
            tone: 'info',
            text: 'Share cancelled.',
          })
        } else {
          const message = error instanceof Error ? error.message : 'The share sheet could not open.'
          setStatus({
            tone: 'error',
            text: message,
          })
        }
      }
    })
  }

  const isBusy = activeAction !== null

  const buttonBaseClassName =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-slate-200 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-70'

  const getActionLabel = (action: Exclude<ActiveAction, null>) => {
    if (action === 'copy') return 'Copy image'
    if (action === 'download') return 'Download PNG'
    return 'Share image'
  }

  return (
    <div className="relative">
      <div
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 shadow-lg backdrop-blur-sm"
        aria-label={title}
      >
        <button
          type="button"
          onClick={copyImage}
          disabled={isBusy}
          className={buttonBaseClassName}
          aria-label={getActionLabel('copy')}
          title={getActionLabel('copy')}
        >
          {activeAction === 'copy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={downloadImage}
          disabled={isBusy}
          className={buttonBaseClassName}
          aria-label={getActionLabel('download')}
          title={getActionLabel('download')}
        >
          {activeAction === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>

        {supportsNativeShare && (
          <button
            type="button"
            onClick={shareImage}
            disabled={isBusy}
            className={buttonBaseClassName}
            aria-label={getActionLabel('share')}
            title={getActionLabel('share')}
          >
            {activeAction === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      {status && (
        <p
          className={`absolute right-0 top-full z-10 mt-2 flex w-72 items-start gap-2 rounded-xl border px-3 py-2.5 text-sm leading-6 shadow-xl ${getStatusClasses(status.tone)}`}
          role="status"
        >
          {status.tone === 'success' && <Check className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{status.text}</span>
        </p>
      )}
      <span className="sr-only">{description}</span>
    </div>
  )
}
