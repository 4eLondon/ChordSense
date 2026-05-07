import React from 'react'
import { Chord } from 'tonal'
import ChordDiagram from './ChordDiagram'
import { getRomanNumeral } from './musicTheory'

const ACCENT  = 'var(--accent)'
const YELLOW  = 'var(--yellow)'
const DIMTEXT = 'rgba(255,255,255,0.35)'
const DIM2    = 'var(--text2)'

function getNotes(chordName) {
  if (!chordName) return []
  try {
    const info = Chord.get(chordName)
    return info.empty ? [] : (info.notes || [])
  } catch { return [] }
}

function parseChord(chordName) {
  if (!chordName) return { root: null, quality: '' }
  const m = chordName.match(/^([A-G][#b]?)(.*)$/)
  return { root: m?.[1] || chordName, quality: m?.[2] || '' }
}

function ChordCard({ chordName, role, keyRoot, timeUntil, isMobile = false }) {
  const isNow   = role === 'now'
  const isEmpty = !chordName
  const urgent  = !isNow && timeUntil != null && timeUntil < 4

  const { root, quality } = parseChord(chordName)
  const notes  = getNotes(chordName)
  const roman  = keyRoot && chordName ? getRomanNumeral(chordName, keyRoot) : null

  const accentColor = isNow ? ACCENT : urgent ? YELLOW : DIM2
  const borderColor = isNow
    ? 'rgba(200,245,90,0.30)'
    : urgent
    ? 'rgba(255,200,90,0.30)'
    : 'rgba(255,255,255,0.08)'
  const bgColor = isNow
    ? 'rgba(200,245,90,0.06)'
    : urgent
    ? 'rgba(255,200,90,0.06)'
    : 'rgba(255,255,255,0.02)'

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: bgColor,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 18,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      transition: 'border-color 0.3s, background 0.3s',
    }}>

      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
        <span style={{
          fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
          fontFamily: '"DM Mono", monospace', fontWeight: 700,
          color: accentColor,
        }}>
          {isNow ? '▶  Now' : '→  Up next'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {roman && (
            <span style={{
              fontSize: 11, fontFamily: '"DM Mono", monospace',
              color: accentColor, opacity: 0.65,
            }}>
              {roman.label}
            </span>
          )}
          {!isNow && timeUntil != null && (
            <span style={{
              fontSize: 11, fontFamily: '"DM Mono", monospace',
              color: accentColor,
              background: urgent ? 'rgba(255,200,90,0.12)' : 'rgba(255,255,255,0.06)',
              border: `0.5px solid ${urgent ? 'rgba(255,200,90,0.3)' : 'rgba(255,255,255,0.1)'}`,
              padding: '1px 8px', borderRadius: 6,
            }}>
              {timeUntil < 1 ? 'now!' : `${Math.round(timeUntil)}s`}
            </span>
          )}
        </div>
      </div>

      {/* Big chord name */}
      <div style={{ textAlign: 'center', lineHeight: 1, padding: '0.25rem 0' }}>
        {isEmpty ? (
          <span style={{ fontSize: 52, fontFamily: '"DM Serif Display", serif', color: 'rgba(255,255,255,0.15)' }}>—</span>
        ) : (
          <span style={{ fontFamily: '"DM Serif Display", serif', lineHeight: 1, color: accentColor }}>
            <span style={{ fontSize: 'clamp(44px, 6vw, 68px)' }}>{root}</span>
            {quality && (
              <span style={{ fontSize: 'clamp(24px, 3.3vw, 38px)', opacity: 0.8 }}>{quality}</span>
            )}
          </span>
        )}
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
          {notes.map((n, i) => (
            <span key={i} style={{
              fontSize: 12, fontFamily: '"DM Mono", monospace',
              color: isNow ? ACCENT : DIM2,
              background: isNow ? 'rgba(200,245,90,0.10)' : 'rgba(255,255,255,0.06)',
              border: `0.5px solid ${isNow ? 'rgba(200,245,90,0.25)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 6, padding: '2px 9px',
            }}>
              {n}
            </span>
          ))}
        </div>
      )}

      {/* Piano diagram — always show NOW, only show NEXT on desktop */}
      {(isNow || !isMobile) && <ChordDiagram chordName={chordName} dim={!isNow} />}
    </div>
  )
}

export default function NowNextCards({ currentChord, nextEntry, keyRoot, playbackTime, simplifyFn, isMobile = false }) {
  const nextChord  = nextEntry?.chord || null
  const timeUntil  = nextEntry ? Math.max(0, nextEntry.time - playbackTime) : null
  const displayNow  = simplifyFn ? simplifyFn(currentChord) : currentChord
  const displayNext = simplifyFn ? simplifyFn(nextChord)    : nextChord

  return (
    <div style={{ display: 'flex', gap: isMobile ? '0.75rem' : '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
      <ChordCard chordName={displayNow}  role="now"  keyRoot={keyRoot} isMobile={isMobile} />
      <ChordCard chordName={displayNext} role="next" keyRoot={keyRoot} timeUntil={timeUntil} isMobile={isMobile} />
    </div>
  )
}
