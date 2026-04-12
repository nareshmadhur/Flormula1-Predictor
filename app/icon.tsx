import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#020617',
          border: '1px solid rgba(239, 68, 68, 0.75)',
          borderRadius: '8px',
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
            bottom: 6,
            height: 2,
            left: 6,
            position: 'absolute',
            width: 20,
          }}
        />
        <div
          style={{
            alignItems: 'baseline',
            display: 'flex',
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 900,
            gap: 1,
            letterSpacing: -2,
            lineHeight: 1,
            marginLeft: -1,
            marginTop: -1,
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
