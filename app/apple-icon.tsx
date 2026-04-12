import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#020617',
          border: '5px solid rgba(239, 68, 68, 0.72)',
          borderRadius: '42px',
          color: '#f8fafc',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            background: '#ef4444',
            borderRadius: 999,
            bottom: 35,
            height: 10,
            left: 36,
            position: 'absolute',
            width: 108,
          }}
        />
        <div
          style={{
            background: 'rgba(248, 250, 252, 0.18)',
            borderRadius: 999,
            bottom: 52,
            height: 5,
            left: 52,
            position: 'absolute',
            width: 76,
          }}
        />
        <div
          style={{
            alignItems: 'baseline',
            display: 'flex',
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: 78,
            fontStyle: 'italic',
            fontWeight: 900,
            gap: 5,
            letterSpacing: -10,
            lineHeight: 1,
            marginLeft: -8,
            marginTop: -4,
            textShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          }}
        >
          <span style={{ color: '#ef4444' }}>FL</span>
          <span style={{ color: '#f8fafc' }}>1</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
