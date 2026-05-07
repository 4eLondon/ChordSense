import React, { useRef, useEffect, useMemo } from 'react'
import { getRomanNumeral, chordMatchesFilter } from './musicTheory'

export default function ChordTimeline({
  timeline,
  playbackTime,
  duration,
  keyRoot,
  filterId,
  simplifyFn,
  onSeek,
}) {
  const containerRef = useRef(null)
  const activeRef = useRef(null)

  // Find active index
  const activeIdx = useMemo(() => {
    if (!timeline.length) return -1
    let idx = 0
    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].time <= playbackTime) idx = i
      else break
    }
    return idx
  }, [timeline, playbackTime])

  // Scroll so current chord sits at ~20% from the left — future chords fill the right 80%
  useEffect(() => {
    const container = containerRef.current
    const activeEl = activeRef.current
    if (!container || !activeEl) return

    const containerWidth = container.clientWidth
    const elLeft = activeEl.offsetLeft
    const elWidth = activeEl.offsetWidth

    // Place active chord at 20% from left edge
    const targetScroll = elLeft - containerWidth * 0.20 + elWidth / 2
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' })
  }, [activeIdx])

  if (!timeline.length) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '0.5px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.65rem 1.25rem',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Timeline
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { color: 'var(--accent)', label: 'Now' },
              { color: '#ffc85a', label: 'Next' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)' }}>
            {timeline.length} chords · tap to jump
          </span>
        </div>
      </div>

      {/* Scrollable chord strip */}
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '0.75rem 1rem',
          gap: 5,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          // Fade left edge (past) and keep right bright (future)
          maskImage: 'linear-gradient(to right, transparent 0px, black 60px, black calc(100% - 20px), black 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0px, black 60px, black calc(100% - 20px), black 100%)',
        }}
      >
        {/* Left spacer — allows first chord to scroll into the 20% anchor */}
        <div style={{ flexShrink: 0, width: 24 }} />

        {timeline.map((entry, i) => {
          const isPast = i < activeIdx
          const isCurrent = i === activeIdx
          const isNext = i === activeIdx + 1
          const isSoon = i === activeIdx + 2 || i === activeIdx + 3
          const chord = simplifyFn ? simplifyFn(entry.chord) : entry.chord
          const roman = keyRoot ? getRomanNumeral(entry.chord, keyRoot) : null
          const matches = filterId === 'all' || chordMatchesFilter(entry.chord, filterId, keyRoot)

          const nextTime = timeline[i + 1]?.time ?? duration
          const chordDuration = Math.max(0.5, nextTime - entry.time)
          const w = Math.min(130, Math.max(68, chordDuration * 16))

          let bg, border, textColor, opacity
          if (isCurrent) {
            bg = 'rgba(200,245,90,0.12)'
            border = '1.5px solid rgba(200,245,90,0.55)'
            textColor = 'var(--accent)'
            opacity = 1
          } else if (isNext) {
            bg = 'rgba(255,200,90,0.08)'
            border = '1px solid rgba(255,200,90,0.40)'
            textColor = '#ffc85a'
            opacity = 1
          } else if (isSoon) {
            bg = 'rgba(255,255,255,0.03)'
            border = '0.5px solid rgba(255,255,255,0.10)'
            textColor = 'rgba(255,255,255,0.55)'
            opacity = 1
          } else if (isPast) {
            bg = 'transparent'
            border = '0.5px solid rgba(255,255,255,0.04)'
            textColor = 'rgba(255,255,255,0.22)'
            opacity = matches ? 1 : 0.15
          } else {
            bg = 'rgba(255,255,255,0.02)'
            border = '0.5px solid rgba(255,255,255,0.06)'
            textColor = 'rgba(255,255,255,0.40)'
            opacity = matches ? 1 : 0.2
          }

          return (
            <button
              key={i}
              ref={isCurrent ? activeRef : null}
              onClick={() => onSeek(entry.time)}
              style={{
                flexShrink: 0,
                width: w,
                minHeight: 70,
                padding: '0.5rem 0.375rem',
                borderRadius: 10,
                border,
                background: bg,
                opacity,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                transition: 'opacity 0.2s ease, border 0.2s ease, background 0.2s ease',
                position: 'relative',
              }}
            >
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: 5, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 5, height: 5,
                  background: 'var(--accent)', borderRadius: '50%',
                  animation: 'pulse 1.2s ease infinite',
                }} />
              )}

              {roman && (
                <span style={{
                  fontSize: 8, fontFamily: 'var(--font-mono)',
                  color: isCurrent ? 'rgba(200,245,90,0.6)' : isNext ? 'rgba(255,200,90,0.5)' : 'rgba(255,255,255,0.2)',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  {roman.label}
                </span>
              )}

              <span style={{
                fontSize: isCurrent ? 15 : isNext ? 14 : 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: isCurrent || isNext ? 600 : 400,
                color: textColor,
                letterSpacing: '-0.01em',
                transition: 'all 0.2s',
              }}>
                {chord}
              </span>

              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)',
                color: 'rgba(255,255,255,0.2)',
              }}>
                {entry.timeLabel}
              </span>
            </button>
          )
        })}

        {/* Right spacer — ensures last chords can scroll into view */}
        <div style={{ flexShrink: 0, width: '60vw' }} />
      </div>

      {/* Song progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', margin: '0 1rem 0.75rem' }}>
        <div style={{
          height: '100%',
          width: `${duration > 0 ? (playbackTime / duration) * 100 : 0}%`,
          background: 'var(--accent)',
          borderRadius: 2,
          transition: 'width 0.1s linear',
        }} />
      </div>
    </div>
  )
}
