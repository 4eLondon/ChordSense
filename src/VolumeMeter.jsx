import React from 'react'

export default function VolumeMeter({ volume }) {
  const bars = 20
  const active = Math.round(volume * bars)

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
      {Array.from({ length: bars }, (_, i) => {
        const isActive = i < active
        const heightPct = 40 + (i / bars) * 60
        const color = i < bars * 0.6
          ? 'var(--accent)'
          : i < bars * 0.85
          ? '#f5c84a'
          : 'var(--red)'
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: `${heightPct}%`,
              background: isActive ? color : 'rgba(255,255,255,0.08)',
              borderRadius: 1,
              transition: 'background 0.05s ease',
            }}
          />
        )
      })}
    </div>
  )
}
