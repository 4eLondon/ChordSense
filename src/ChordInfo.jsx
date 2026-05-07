import React, { useMemo } from 'react'
import { Chord } from 'tonal'

const CHORD_TYPE_COLORS = {
  major: { bg: 'rgba(200, 245, 90, 0.12)', border: 'rgba(200, 245, 90, 0.3)', text: '#c8f55a' },
  minor: { bg: 'rgba(107, 181, 255, 0.12)', border: 'rgba(107, 181, 255, 0.3)', text: '#6bb5ff' },
  dominant: { bg: 'rgba(255, 165, 90, 0.12)', border: 'rgba(255, 165, 90, 0.3)', text: '#ffa55a' },
  diminished: { bg: 'rgba(255, 107, 107, 0.12)', border: 'rgba(255, 107, 107, 0.3)', text: '#ff6b6b' },
  augmented: { bg: 'rgba(176, 107, 255, 0.12)', border: 'rgba(176, 107, 255, 0.3)', text: '#b06bff' },
  suspended: { bg: 'rgba(90, 220, 200, 0.12)', border: 'rgba(90, 220, 200, 0.3)', text: '#5adcc8' },
  default: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', text: '#f0f0f5' },
}

function getChordColor(chordName) {
  const lower = chordName.toLowerCase()
  if (lower.includes('dim')) return CHORD_TYPE_COLORS.diminished
  if (lower.includes('aug') || lower.includes('+')) return CHORD_TYPE_COLORS.augmented
  if (lower.includes('sus')) return CHORD_TYPE_COLORS.suspended
  if (lower.includes('7') || lower.includes('9') || lower.includes('dom')) return CHORD_TYPE_COLORS.dominant
  if (lower.includes('m') && !lower.startsWith('m')) return CHORD_TYPE_COLORS.minor
  if (/^[a-g][#b]?m/i.test(chordName)) return CHORD_TYPE_COLORS.minor
  return CHORD_TYPE_COLORS.major
}

export default function ChordInfo({ chordName }) {
  const info = useMemo(() => {
    if (!chordName) return null
    try {
      const chord = Chord.get(chordName)
      return chord.empty ? null : chord
    } catch {
      return null
    }
  }, [chordName])

  if (!chordName) return null

  const colors = getChordColor(chordName)

  // Parse root and quality from chord name
  const rootMatch = chordName.match(/^([A-G][#b]?)(.*)$/)
  const root = rootMatch?.[1] || chordName
  const quality = rootMatch?.[2] || ''

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: '2rem',
      textAlign: 'center',
    }}>
      {/* Big chord name */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(48px, 10vw, 80px)',
        lineHeight: 1,
        color: colors.text,
        marginBottom: '0.5rem',
        letterSpacing: '-0.02em',
      }}>
        <span>{root}</span>
        {quality && (
          <span style={{ fontSize: '60%', opacity: 0.8 }}>{quality}</span>
        )}
      </div>

      {/* Chord full name */}
      {info?.name && (
        <div style={{
          fontSize: 14,
          color: 'var(--text2)',
          marginBottom: '1.5rem',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em',
        }}>
          {info.name}
        </div>
      )}

      {/* Notes in chord */}
      {info?.notes && info.notes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {info.notes.map((note, i) => (
            <span key={i} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '4px 14px',
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text)',
            }}>
              {note}
            </span>
          ))}
        </div>
      )}

      {/* Intervals */}
      {info?.intervals && info.intervals.length > 0 && (
        <div style={{
          marginTop: '1rem',
          fontSize: 12,
          color: 'var(--text3)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.08em',
        }}>
          {info.intervals.join(' · ')}
        </div>
      )}
    </div>
  )
}
