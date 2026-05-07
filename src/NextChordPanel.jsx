import React from 'react'
import { getRomanNumeral } from './musicTheory'

export default function NextChordPanel({ nextEntry, keyRoot, simplified, simplifyFn, timeUntil }) {
  if (!nextEntry) return null

  const chordToShow = simplifyFn ? simplifyFn(nextEntry.chord) : nextEntry.chord
  const roman = keyRoot ? getRomanNumeral(nextEntry.chord, keyRoot) : null

  // Color based on how soon
  const urgency = timeUntil < 2 ? 'near' : timeUntil < 5 ? 'mid' : 'far'
  const colors = {
    near: { bg: 'rgba(255, 200, 90, 0.10)', border: 'rgba(255, 200, 90, 0.30)', text: '#ffc85a', label: 'UP NEXT : get ready' },
    mid:  { bg: 'rgba(107, 181, 255, 0.08)', border: 'rgba(107, 181, 255, 0.25)', text: '#6bb5ff', label: 'UP NEXT' },
    far:  { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: 'var(--text2)', label: 'UP NEXT' },
  }[urgency]

  // Parse root + quality suffix for display
  const rootMatch = chordToShow.match(/^([A-G][#b]?)(.*)$/)
  const root = rootMatch?.[1] || chordToShow
  const quality = rootMatch?.[2] || ''

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: '1.25rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1.25rem',
      transition: 'all 0.4s ease',
    }}>
      {/* Arrow */}
      <div style={{
        color: colors.text,
        opacity: 0.7,
        fontSize: 22,
        flexShrink: 0,
        animation: urgency === 'near' ? 'arrowPulse 0.8s ease infinite' : 'none',
      }}>
        →
      </div>

      {/* Chord name */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          color: colors.text,
          opacity: 0.7,
          marginBottom: 4,
          textTransform: 'uppercase',
        }}>
          {colors.label}
          {timeUntil != null && (
            <span style={{ marginLeft: 8, opacity: 0.6 }}>in {timeUntil.toFixed(1)}s</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 40,
            lineHeight: 1,
            color: colors.text,
            letterSpacing: '-0.02em',
          }}>
            {root}
            {quality && <span style={{ fontSize: '65%' }}>{quality}</span>}
          </span>
          {roman && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: colors.text,
              opacity: 0.5,
              paddingBottom: 2,
            }}>
              {roman.label}
            </span>
          )}
        </div>
      </div>

      {/* Time bar */}
      {timeUntil != null && timeUntil < 8 && (
        <div style={{ flexShrink: 0, width: 4, height: 48, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', alignSelf: 'center' }}>
          <div style={{
            position: 'relative',
            bottom: 0,
            width: '100%',
            height: `${Math.max(5, (1 - timeUntil / 8) * 100)}%`,
            background: colors.text,
            borderRadius: 2,
            transition: 'height 0.3s ease',
            marginTop: 'auto',
            alignSelf: 'flex-end',
          }} />
        </div>
      )}
    </div>
  )
}
