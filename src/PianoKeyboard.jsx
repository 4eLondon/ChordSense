import React, { useMemo } from 'react'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]) // pitch classes

// One octave worth of 7 white keys
const WHITE_KEY_ORDER = [0, 2, 4, 5, 7, 9, 11]

function PianoOctave({ octave, activeNotes, startX, keyWidth, keyHeight }) {
  const blackKeyWidth = keyWidth * 0.6
  const blackKeyHeight = keyHeight * 0.6

  const whiteKeys = WHITE_KEY_ORDER.map((pc, i) => ({
    pc, x: startX + i * keyWidth, note: NOTE_NAMES[pc]
  }))

  const blackKeyPositions = [0.7, 1.7, 3.7, 4.7, 5.7]
  const blackKeyPCs = [1, 3, 6, 8, 10]

  const blackKeys = blackKeyPCs.map((pc, i) => ({
    pc, x: startX + blackKeyPositions[i] * keyWidth - blackKeyWidth / 2, note: NOTE_NAMES[pc]
  }))

  return (
    <>
      {whiteKeys.map(({ pc, x, note }) => {
        const active = activeNotes.includes(note)
        return (
          <rect
            key={`w-${octave}-${pc}`}
            x={x + 1} y={0}
            width={keyWidth - 2} height={keyHeight}
            rx={3}
            fill={active ? 'var(--accent)' : 'rgba(255,255,255,0.92)'}
            stroke={active ? 'var(--accent2)' : 'rgba(0,0,0,0.15)'}
            strokeWidth={active ? 1.5 : 0.5}
            style={{ transition: 'fill 0.1s ease' }}
          />
        )
      })}
      {blackKeys.map(({ pc, x, note }) => {
        const active = activeNotes.includes(note)
        return (
          <rect
            key={`b-${octave}-${pc}`}
            x={x} y={0}
            width={blackKeyWidth} height={blackKeyHeight}
            rx={2}
            fill={active ? 'var(--accent)' : '#1a1a24'}
            stroke={active ? 'var(--accent2)' : 'rgba(255,255,255,0.05)'}
            strokeWidth={active ? 1.5 : 0.5}
            style={{ transition: 'fill 0.1s ease' }}
          />
        )
      })}
    </>
  )
}

export default function PianoKeyboard({ activeNotes = [] }) {
  const octaves = 3
  const keysPerOctave = 7
  const keyWidth = 30
  const keyHeight = 80
  const totalWidth = octaves * keysPerOctave * keyWidth

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${keyHeight}`}
      width="100%"
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {Array.from({ length: octaves }, (_, i) => (
        <PianoOctave
          key={i}
          octave={i + 3}
          activeNotes={activeNotes}
          startX={i * keysPerOctave * keyWidth}
          keyWidth={keyWidth}
          keyHeight={keyHeight}
        />
      ))}
    </svg>
  )
}
