import React, { useMemo } from 'react'
import { Chord } from 'tonal'

// One octave of keys starting from C
// white key pitch classes in order: C D E F G A B
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
// black key pitch classes: C# D# F# G# A#
// positioned between whites: between index 0-1, 1-2, 3-4, 4-5, 5-6
const BLACK_KEYS = [
  { pc: 1,  afterWhite: 0 },
  { pc: 3,  afterWhite: 1 },
  { pc: 6,  afterWhite: 3 },
  { pc: 8,  afterWhite: 4 },
  { pc: 10, afterWhite: 5 },
]

const ENHARMONIC = {
  'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B','Fb':'E','E#':'F','B#':'C'
}
function normPc(note) {
  const n = ENHARMONIC[note] || note
  return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(n)
}

export default function ChordDiagram({ chordName, label = 'NOW', dim = false }) {
  const activePCs = useMemo(() => {
    if (!chordName) return new Set()
    try {
      const info = Chord.get(chordName)
      if (info.empty || !info.notes?.length) {
        // Fallback: parse root from name and build triad
        const m = chordName.match(/^([A-G][#b]?)(.*)$/)
        if (!m) return new Set()
        const rootPc = normPc(m[1])
        const isMinor = /^m(?!aj)/i.test(m[2])
        if (rootPc === -1) return new Set()
        return new Set([rootPc, (rootPc + (isMinor ? 3 : 4)) % 12, (rootPc + 7) % 12])
      }
      return new Set(info.notes.map(n => normPc(n)).filter(p => p >= 0))
    } catch { return new Set() }
  }, [chordName])

  const W = 28   // white key width
  const WH = 72  // white key height
  const BW = 18  // black key width
  const BH = 44  // black key height
  const OCTAVES = 2
  const totalWhites = OCTAVES * 7
  const svgW = totalWhites * W
  const svgH = WH + 2

  if (!chordName) return (
    <div style={{ textAlign: 'center', opacity: 0.25, padding: '1rem 0' }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', maxWidth: 380 }}>
        {Array.from({ length: totalWhites }, (_, i) => (
          <rect key={i} x={i * W + 1} y={1} width={W - 2} height={WH - 2}
            rx={3} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
        ))}
      </svg>
    </div>
  )

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', maxWidth: 420, margin: '0 auto' }}>
        {/* White keys */}
        {Array.from({ length: OCTAVES }, (_, oct) =>
          WHITE_PCS.map((pc, wi) => {
            const x = (oct * 7 + wi) * W
            const isActive = activePCs.has(pc)
            return (
              <g key={`w-${oct}-${wi}`}>
                <rect x={x + 1} y={1} width={W - 2} height={WH - 2} rx={3}
                  fill={isActive
                    ? (dim ? 'var(--purple)' : 'var(--accent)')
                    : 'rgba(255,255,255,0.92)'}
                  stroke={isActive
                    ? (dim ? 'var(--purple)' : 'var(--accent2)')
                    : 'rgba(0,0,0,0.15)'}
                  strokeWidth={isActive ? 1.5 : 0.5}
                />
                {isActive && (
                  <circle cx={x + W / 2} cy={WH - 10} r={6}
                    fill={dim ? 'var(--purple)' : 'var(--accent-dark)'}
                    opacity={0.85}
                  />
                )}
              </g>
            )
          })
        )}
        {/* Black keys (drawn on top) */}
        {Array.from({ length: OCTAVES }, (_, oct) =>
          BLACK_KEYS.map(({ pc, afterWhite }) => {
            const x = (oct * 7 + afterWhite) * W + W - BW / 2
            const isActive = activePCs.has(pc)
            return (
              <g key={`b-${oct}-${pc}`}>
                <rect x={x} y={1} width={BW} height={BH} rx={2}
                  fill={isActive
                    ? (dim ? 'rgba(176,107,255,0.85)' : 'rgba(200,245,90,0.85)')
                    : '#111118'}
                  stroke={isActive
                    ? (dim ? 'rgba(176,107,255,1)' : '#a8d93a')
                    : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isActive ? 1.5 : 0.5}
                />
                {isActive && (
                  <circle cx={x + BW / 2} cy={BH - 8} r={5}
                    fill={dim ? 'var(--purple)' : 'var(--accent-dark)'}
                    opacity={0.85}
                  />
                )}
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}
