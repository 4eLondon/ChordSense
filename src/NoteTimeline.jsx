import React, { useMemo } from 'react'

export default function NoteTimeline({ noteTimeline, playbackTime, duration, isMobile }) {
  const currentEntry = useMemo(() => {
    if (!noteTimeline.length) return null
    for (let i = noteTimeline.length - 1; i >= 0; i--) {
      if (noteTimeline[i].time <= playbackTime) return noteTimeline[i]
    }
    return noteTimeline[0]
  }, [noteTimeline, playbackTime])
  
  if (!noteTimeline.length) {
    return (
      <div style={{
        padding: '1rem',
        background: 'var(--bg3)',
        borderRadius: 12,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 13,
      }}>
        No notes in timeline
      </div>
    )
  }
  
  const containerWidth = isMobile ? 280 : 600
  const pixelsPerSecond = containerWidth / duration
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Label */}
      <div style={{
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Note Timeline
      </div>
      
      {/* Timeline container */}
      <div style={{
        position: 'relative',
        width: containerWidth,
        height: 60,
        background: 'var(--bg3)',
        borderRadius: 8,
        overflow: 'hidden',
        border: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        {/* Background regions for each note entry */}
        {noteTimeline.map((entry, idx) => {
          const nextEntry = noteTimeline[idx + 1]
          const endTime = nextEntry ? nextEntry.time : duration
          const startPx = entry.time * pixelsPerSecond
          const widthPx = (endTime - entry.time) * pixelsPerSecond
          const noteCount = entry.notes.length
          
          // Hue based on note count
          const hue = 120 + (noteCount * 15) % 120
          const saturation = 60 + (noteCount * 5) % 20
          const lightness = entry === currentEntry ? 45 : 35
          
          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: startPx,
                width: Math.max(2, widthPx),
                height: '100%',
                background: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                transition: 'background 0.15s ease',
                borderRight: idx < noteTimeline.length - 1 ? '0.5px solid rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: 'rgba(255,255,255,0.6)',
                overflow: 'hidden',
              }}
              title={`${entry.timeLabel}: ${entry.notes.map(n => n.name).join(', ')}`}
            >
              {widthPx > 20 && entry.notes.length > 0 && (
                <span style={{ opacity: 0.7 }}>{entry.notes.length}</span>
              )}
            </div>
          )
        })}
        
        {/* Playhead */}
        <div
          style={{
            position: 'absolute',
            left: `${(playbackTime / duration) * 100}%`,
            top: 0,
            height: '100%',
            width: 2,
            background: 'var(--accent)',
            boxShadow: '0 0 8px rgba(200,245,90,0.4)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>
      
      {/* Current notes display */}
      {currentEntry && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          padding: '0.75rem',
          background: 'rgba(200,245,90,0.05)',
          borderRadius: 8,
          border: '0.5px solid rgba(200,245,90,0.15)',
        }}>
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.4)',
            alignSelf: 'center',
          }}>
            {currentEntry.timeLabel}
          </span>
          {currentEntry.notes.map((note, idx) => (
            <span
              key={idx}
              style={{
                padding: '3px 8px',
                background: 'rgba(200,245,90,0.10)',
                border: '0.5px solid rgba(200,245,90,0.25)',
                borderRadius: 5,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: '#c8f55a',
                fontWeight: 500,
              }}
            >
              {note.name} ({Math.round(note.confidence * 100)}%)
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
