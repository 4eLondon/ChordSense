import React, { useRef, useEffect, useCallback } from 'react'
import { getRomanNumeral } from './musicTheory'

// Chord type → color
function chordColor(chordName, alpha = 1) {
  if (!chordName) return `rgba(100,100,120,${alpha})`
  const s = chordName.toLowerCase()
  if (s.includes('dim') || s.includes('°')) return `rgba(255,107,107,${alpha})`    // red
  if (s.includes('aug') || s.includes('+')) return `rgba(176,107,255,${alpha})`    // purple
  if (s.includes('sus'))                    return `rgba(90,220,200,${alpha})`     // teal
  if (/[0-9]/.test(chordName.replace(/^[A-G][#b]?/, '')))
                                            return `rgba(107,181,255,${alpha})`    // blue (7ths/9ths)
  const suffix = chordName.match(/^[A-G][#b]?(.*)/)?.[1] || ''
  if (/^m(?!aj)/i.test(suffix))            return `rgba(107,181,255,${alpha})`    // blue (minor)
  return `rgba(200,245,90,${alpha})`                                               // green (major)
}

const RULER_H    = 20   // px — time ruler at top
const TRACK_H    = 56   // px — chord block height
const LABEL_W    = 52   // px — left gutter for timestamps
const PX_PER_SEC = 80   // px per second of audio — controls zoom level

export default function RulerTimeline({
  isMobile = false,
  timeline,
  duration,
  playbackTime,
  keyRoot,
  simplifyFn,
  onSeek,
  isPlaying,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const isDragging = useRef(false)

  const totalW = Math.max(800, Math.ceil(duration * PX_PER_SEC) + LABEL_W + 120)
  const canvasH = RULER_H + TRACK_H + 2

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.width / dpr
    const H = canvas.height / dpr

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Background
    ctx.fillStyle = '#0d0d14'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // ── Ruler ───────────────────────────────────────────────────────────────
    ctx.fillStyle = '#13131c'
    ctx.fillRect(0, 0, canvas.width, RULER_H * dpr)

    // Time ticks every 5 seconds, labels every 10s
    const tickInterval = 5
    const labelInterval = 10
    for (let t = 0; t <= duration + tickInterval; t += tickInterval) {
      const x = (LABEL_W + t * PX_PER_SEC) * dpr
      const isMajor = t % labelInterval === 0

      ctx.beginPath()
      ctx.moveTo(x, isMajor ? 0 : RULER_H * dpr * 0.5)
      ctx.lineTo(x, RULER_H * dpr)
      ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'
      ctx.lineWidth = isMajor ? 1 * dpr : 0.5 * dpr
      ctx.stroke()

      if (isMajor) {
        const m = Math.floor(t / 60)
        const s = Math.floor(t % 60)
        const label = `${m}:${String(s).padStart(2, '0')}`
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = `${9 * dpr}px "DM Mono", monospace`
        ctx.textAlign = 'left'
        ctx.fillText(label, x + 3 * dpr, (RULER_H - 4) * dpr)
      }
    }

    // Ruler / track divider line
    ctx.beginPath()
    ctx.moveTo(0, RULER_H * dpr)
    ctx.lineTo(canvas.width, RULER_H * dpr)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()

    // ── Chord blocks ─────────────────────────────────────────────────────────
    const trackY = RULER_H * dpr
    const trackH = TRACK_H * dpr

    timeline.forEach((entry, i) => {
      const nextTime = timeline[i + 1]?.time ?? duration
      const blockX = (LABEL_W + entry.time * PX_PER_SEC) * dpr
      const blockW = Math.max(2 * dpr, (nextTime - entry.time) * PX_PER_SEC * dpr - 2 * dpr)

      const isPast    = nextTime <= playbackTime
      const isCurrent = entry.time <= playbackTime && nextTime > playbackTime
      const isNext    = i > 0
                        ? timeline[i - 1].time <= playbackTime && entry.time > playbackTime
                        : entry.time > playbackTime && i === 0
      const isFuture  = entry.time > playbackTime

      const chord = simplifyFn ? simplifyFn(entry.chord) : entry.chord

      // Block fill
      let fillAlpha = isPast ? 0.18 : isCurrent ? 0.75 : isNext ? 0.45 : 0.28
      ctx.fillStyle = chordColor(entry.chord, fillAlpha)
      ctx.beginPath()
      ctx.roundRect(blockX + 1, trackY + 2 * dpr, blockW - 1, trackH - 4 * dpr, 6 * dpr)
      ctx.fill()

      // Border
      if (isCurrent) {
        ctx.strokeStyle = chordColor(entry.chord, 1)
        ctx.lineWidth = 1.5 * dpr
        ctx.beginPath()
        ctx.roundRect(blockX + 1, trackY + 2 * dpr, blockW - 1, trackH - 4 * dpr, 6 * dpr)
        ctx.stroke()
      } else if (isNext) {
        ctx.strokeStyle = chordColor(entry.chord, 0.6)
        ctx.lineWidth = 1 * dpr
        ctx.setLineDash([3 * dpr, 3 * dpr])
        ctx.beginPath()
        ctx.roundRect(blockX + 1, trackY + 2 * dpr, blockW - 1, trackH - 4 * dpr, 6 * dpr)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Chord label — only draw if block is wide enough
      if (blockW > 24 * dpr) {
        const roman = keyRoot ? getRomanNumeral(entry.chord, keyRoot) : null
        const labelAlpha = isPast ? 0.35 : 1

        // Roman numeral (small, top of block)
        if (roman && blockW > 40 * dpr) {
          ctx.fillStyle = `rgba(255,255,255,${labelAlpha * 0.5})`
          ctx.font = `${7 * dpr}px "DM Mono", monospace`
          ctx.textAlign = 'center'
          ctx.fillText(roman.label, blockX + blockW / 2, trackY + 14 * dpr)
        }

        // Chord name (main label)
        const fontSize = blockW > 70 * dpr ? 13 : blockW > 40 * dpr ? 11 : 9
        ctx.fillStyle = isCurrent
          ? `rgba(255,255,255,${labelAlpha})`
          : `rgba(255,255,255,${labelAlpha * 0.75})`
        ctx.font = `${isCurrent ? 600 : 400} ${fontSize * dpr}px "DM Mono", monospace`
        ctx.textAlign = 'center'

        // Clip text to block
        ctx.save()
        ctx.beginPath()
        ctx.rect(blockX + 2 * dpr, trackY, blockW - 4 * dpr, trackH)
        ctx.clip()
        ctx.fillText(chord, blockX + blockW / 2, trackY + (roman ? 30 : 34) * dpr)
        ctx.restore()
      }
    })

    // ── Playhead ─────────────────────────────────────────────────────────────
    const playX = (LABEL_W + playbackTime * PX_PER_SEC) * dpr

    // Glow
    const grd = ctx.createLinearGradient(playX - 12 * dpr, 0, playX + 12 * dpr, 0)
    grd.addColorStop(0, 'rgba(200,245,90,0)')
    grd.addColorStop(0.5, 'rgba(200,245,90,0.12)')
    grd.addColorStop(1, 'rgba(200,245,90,0)')
    ctx.fillStyle = grd
    ctx.fillRect(playX - 12 * dpr, 0, 24 * dpr, canvas.height)

    // Line
    ctx.beginPath()
    ctx.moveTo(playX, 0)
    ctx.lineTo(playX, canvas.height)
    ctx.strokeStyle = '#c8f55a'
    ctx.lineWidth = 1.5 * dpr
    ctx.stroke()

    // Triangle handle at top
    ctx.beginPath()
    ctx.moveTo(playX - 6 * dpr, 0)
    ctx.lineTo(playX + 6 * dpr, 0)
    ctx.lineTo(playX, 8 * dpr)
    ctx.closePath()
    ctx.fillStyle = '#c8f55a'
    ctx.fill()

    // Current time label on playhead
    const m = Math.floor(playbackTime / 60)
    const s = Math.floor(playbackTime % 60)
    const timeLabel = `${m}:${String(s).padStart(2, '0')}`
    ctx.fillStyle = '#c8f55a'
    ctx.font = `bold ${9 * dpr}px "DM Mono", monospace`
    ctx.textAlign = 'center'
    ctx.fillText(timeLabel, playX, 19 * dpr)

  }, [timeline, duration, playbackTime, keyRoot, simplifyFn])

  // Setup canvas DPR scaling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = totalW * dpr
    canvas.height = canvasH * dpr
    canvas.style.width  = `${totalW}px`
    canvas.style.height = `${canvasH}px`
  }, [totalW, canvasH])

  // Redraw whenever state changes
  useEffect(() => { draw() }, [draw])

  // Auto-scroll playhead into view (keep it at 30% from left)
  useEffect(() => {
    const container = containerRef.current
    if (!container || isDragging.current) return
    const playX = LABEL_W + playbackTime * PX_PER_SEC
    const containerW = container.clientWidth
    const target = playX - containerW * 0.30
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [Math.floor(playbackTime)]) // only scroll once per second

  // Click/drag to seek
  const getTimeFromEvent = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const t = (x - LABEL_W) / PX_PER_SEC
    return Math.max(0, Math.min(duration, t))
  }

  const handleMouseDown = (e) => {
    isDragging.current = true
    const t = getTimeFromEvent(e)
    if (t !== null) onSeek(t)
  }
  const handleMouseMove = (e) => {
    if (!isDragging.current) return
    const t = getTimeFromEvent(e)
    if (t !== null) onSeek(t)
  }
  const handleMouseUp = () => { isDragging.current = false }

  const handleTouchStart = (e) => {
    e.preventDefault() // prevent page scroll while scrubbing
    isDragging.current = true
    const touch = e.touches[0]
    const canvas = canvasRef.current
    if (!canvas || !touch) return
    const rect = canvas.getBoundingClientRect()
    const t = Math.max(0, Math.min(duration, (touch.clientX - rect.left - LABEL_W) / PX_PER_SEC))
    onSeek(t)
  }
  const handleTouchMove = (e) => {
    if (!isDragging.current) return
    e.preventDefault()
    const touch = e.touches[0]
    const canvas = canvasRef.current
    if (!canvas || !touch) return
    const rect = canvas.getBoundingClientRect()
    const t = Math.max(0, Math.min(duration, (touch.clientX - rect.left - LABEL_W) / PX_PER_SEC))
    onSeek(t)
  }
  const handleTouchEnd = () => { isDragging.current = false }

  if (!timeline.length) return null

  return (
    <div style={{
      background: '#0d0d14',
      border: '0.5px solid rgba(255,255,255,0.09)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Chord Timeline
        </span>

        {/* Color legend */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {[
            { color: '#c8f55a', label: 'Major' },
            { color: '#6bb5ff', label: 'Minor / 7th' },
            { color: '#ff6b6b', label: 'Dim' },
            { color: '#b06bff', label: 'Aug' },
            { color: '#5adcc8', label: 'Sus' },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.35)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>

        <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
          {timeline.length} chords · drag to seek
        </span>
      </div>

      {/* Scrollable canvas */}
      <div
        ref={containerRef}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          cursor: 'pointer',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ display: 'block' }}
        />
      </div>
    </div>
  )
}
