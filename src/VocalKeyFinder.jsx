import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useVocalPitch } from './useVocalPitch'
import { detectKey, buildScale, getMovementsForChord } from './keyDetection'

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const ACCENT = 'var(--accent)'
const BLUE   = 'var(--blue)'
const YELLOW = 'var(--yellow)'
const RED    = 'var(--red)'

// ── Tuner-style cent display ─────────────────────────────────────────────────
function CentMeter({ cents }) {
  const clamped = Math.max(-50, Math.min(50, cents || 0))
  const pct = ((clamped + 50) / 100) * 100
  const inTune = Math.abs(clamped) < 10
  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
        {/* Center line */}
        <div style={{ position:'absolute', left:'50%', top:0, width:1.5, height:'100%', background:'rgba(255,255,255,0.2)' }}/>
        {/* Needle */}
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`,
          transform: 'translate(-50%,-50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: inTune ? ACCENT : Math.abs(clamped) < 25 ? YELLOW : RED,
          transition: 'left 0.1s ease, background 0.2s',
          boxShadow: inTune ? `0 0 8px ${ACCENT}88` : 'none',
        }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
        <span style={{ fontSize:8, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.2)' }}>♭ flat</span>
        <span style={{ fontSize:8, fontFamily:'"DM Mono",monospace', color: inTune ? ACCENT : 'rgba(255,255,255,0.3)' }}>
          {inTune ? '✓ in tune' : `${clamped > 0 ? '+' : ''}${clamped}¢`}
        </span>
        <span style={{ fontSize:8, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.2)' }}>sharp ♯</span>
      </div>
    </div>
  )
}

// ── Rolling note dots ────────────────────────────────────────────────────────
function NoteTrail({ noteHistory }) {
  if (!noteHistory.length) return null
  return (
    <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
      {noteHistory.slice(0,20).map((n, i) => (
        <span key={i} style={{
          fontSize: i === 0 ? 14 : 11,
          fontFamily: '"DM Mono",monospace',
          color: i === 0 ? ACCENT : `rgba(200,245,90,${Math.max(0.15, 0.85 - i*0.04)})`,
          fontWeight: i === 0 ? 700 : 400,
          transition: 'all 0.15s',
        }}>
          {n.note}
        </span>
      ))}
    </div>
  )
}

// ── Chromatic pitch wheel (circle of notes) ──────────────────────────────────
function PitchWheel({ pitchAccum, detectedRoot, scale }) {
  const max   = Math.max(...pitchAccum, 1)
  const scalePCs = new Set(scale?.map(s => s.pc) || [])
  const cx = 90, cy = 90, r = 68, innerR = 42

  return (
    <svg viewBox="0 0 180 180" width="100%" style={{ maxWidth: 180, display:'block', margin:'0 auto' }}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r+10} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}/>

      {NOTE_NAMES.map((note, i) => {
        const angle     = (i / 12) * 2 * Math.PI - Math.PI / 2
        const energy    = pitchAccum[i] / max
        const isRoot    = i === detectedRoot
        const inScale   = scalePCs.has(i)
        const sliceR    = innerR + energy * (r - innerR)

        // Slice arc path
        const a0 = angle - Math.PI / 12 + 0.04
        const a1 = angle + Math.PI / 12 - 0.04
        const ox0 = cx + innerR * Math.cos(a0), oy0 = cy + innerR * Math.sin(a0)
        const ox1 = cx + innerR * Math.cos(a1), oy1 = cy + innerR * Math.sin(a1)
        const ix0 = cx + sliceR * Math.cos(a0), iy0 = cy + sliceR * Math.sin(a0)
        const ix1 = cx + sliceR * Math.cos(a1), iy1 = cy + sliceR * Math.sin(a1)

        const path = [
          `M ${ox0} ${oy0}`,
          `L ${ix0} ${iy0}`,
          `A ${sliceR} ${sliceR} 0 0 1 ${ix1} ${iy1}`,
          `L ${ox1} ${oy1}`,
          `A ${innerR} ${innerR} 0 0 0 ${ox0} ${oy0}`,
        ].join(' ')

        // Label position (outer)
        const labelR = r + 16
        const lx = cx + labelR * Math.cos(angle)
        const ly = cy + labelR * Math.sin(angle)

        const fillColor = isRoot    ? ACCENT
                        : inScale   ? 'rgba(200,245,90,0.45)'
                        : energy > 0.1 ? 'rgba(107,181,255,0.35)'
                        : 'rgba(255,255,255,0.07)'

        return (
          <g key={note}>
            <path d={path} fill={fillColor} style={{ transition:'all 0.4s ease' }}/>
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              style={{
                fontSize: isRoot ? 9 : 7.5,
                fontFamily: '"DM Mono",monospace',
                fill: isRoot ? ACCENT : inScale ? 'rgba(200,245,90,0.7)' : 'rgba(255,255,255,0.25)',
                fontWeight: isRoot ? 700 : 400,
              }}>
              {note}
            </text>
          </g>
        )
      })}

      {/* Center: key label */}
      <text x={cx} y={cy - 8} textAnchor="middle"
        style={{ fontSize:22, fontFamily:'"DM Serif Display",serif', fill: ACCENT }}>
        {detectedRoot != null ? NOTE_NAMES[detectedRoot] : '?'}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle"
        style={{ fontSize:9, fontFamily:'"DM Mono",monospace', fill:'rgba(200,245,90,0.5)' }}>
        {scale?.[0]?.quality === 'min' ? 'minor' : 'major'}
      </text>
    </svg>
  )
}

// ── Chord card for "play these chords" ──────────────────────────────────────
function PlayChordCard({ entry, highlight }) {
  const qualityColors = {
    maj: ACCENT, min: BLUE, dim: RED, dom7: YELLOW,
  }
  const color = qualityColors[entry.quality] || ACCENT
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 12,
      background: highlight ? `${color}18` : 'rgba(255,255,255,0.03)',
      border: `${highlight ? 1.5 : 0.5}px solid ${highlight ? color : 'rgba(255,255,255,0.08)'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      transition: 'all 0.25s',
      minWidth: 60,
    }}>
      <span style={{ fontSize:9, fontFamily:'"DM Mono",monospace', color: highlight ? color : 'rgba(255,255,255,0.3)', letterSpacing:'0.05em' }}>
        {entry.roman}
      </span>
      <span style={{ fontSize:20, fontFamily:'"DM Serif Display",serif', color: highlight ? color : 'rgba(255,255,255,0.65)', lineHeight:1 }}>
        {entry.chord}
      </span>
      <span style={{ fontSize:8, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.2)', textTransform:'uppercase' }}>
        {entry.quality}
      </span>
    </div>
  )
}

// ── Confidence ring ──────────────────────────────────────────────────────────
function ConfRing({ value }) {
  const r = 24, stroke = 4, circ = 2*Math.PI*r
  const color = value>=0.75?ACCENT:value>=0.5?YELLOW:RED
  return (
    <div style={{ position:'relative', width:56, height:56, flexShrink:0 }}>
      <svg width={56} height={56} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
        <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circ*value} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.5s ease' }}/>
      </svg>
      <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
        <span style={{ fontSize:11,fontWeight:700,color,fontFamily:'"DM Mono",monospace' }}>
          {Math.round(value*100)}%
        </span>
      </div>
    </div>
  )
}

// ── Volume bar ───────────────────────────────────────────────────────────────
function VolumeBar({ volume }) {
  return (
    <div style={{ display:'flex', gap:2, alignItems:'flex-end', height:28 }}>
      {Array.from({length:24},(_,i)=>{
        const active = i < Math.round(volume*24)
        return <div key={i} style={{
          width:3, height:`${35+(i/24)*65}%`,
          background: active ? (i<14?ACCENT:i<20?YELLOW:RED) : 'rgba(255,255,255,0.07)',
          borderRadius:1, transition:'background 0.05s',
        }}/>
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function VocalKeyFinder() {
  const {
    isListening, start, stop, reset,
    currentNote, currentPitchClass, currentFreq, currentCents,
    pitchConfidence, pitchAccum,
    volume, signalQuality, error, noteHistory,
    sensitivity, setSensitivity,
  } = useVocalPitch()

  const [listenDuration, setListenDuration] = useState(0)
  const timerRef = useRef(null)

  // Timer while listening
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => setListenDuration(d => d + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isListening])

  const handleStart = () => { setListenDuration(0); start() }
  const handleReset = () => { reset(); setListenDuration(0) }

  // Key detection from accumulated pitch data
  const keyResult = useMemo(() => {
    const total = [...pitchAccum].reduce((a,b)=>a+b,0)
    if (total < 2) return null  // not enough data yet
    return detectKey(pitchAccum, [])  // no chord history — pure melodic detection
  }, [pitchAccum])

  // How much data we have (for progress feedback)
  const dataStrength = useMemo(() => {
    const total = [...pitchAccum].reduce((a,b)=>a+b,0)
    return Math.min(1, total / 180)
  }, [pitchAccum])

  const notesHeard = noteHistory.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

      {/* ── Header / controls ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '1rem',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.85)', marginBottom:3 }}>
            🎤 Vocal Key Finder
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontFamily:'"DM Mono",monospace', lineHeight:1.5 }}>
            Point the mic at the singer. The key will be detected from their melody.
          </div>
        </div>

        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {isListening && (
            <button onClick={handleReset} style={{
              padding:'8px 14px', borderRadius:9, fontSize:12, cursor:'pointer',
              background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.45)',
              border:'0.5px solid rgba(255,255,255,0.1)', fontFamily:'"DM Mono",monospace',
            }}>
              Reset
            </button>
          )}
          <button onClick={isListening ? stop : handleStart} style={{
            padding:'9px 20px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer',
            background: isListening ? 'rgba(255,107,107,0.12)' : ACCENT,
            color: isListening ? RED : 'var(--bg)',
            border: isListening ? `0.5px solid ${RED}55` : 'none',
            display:'flex', alignItems:'center', gap:7, transition:'all 0.15s',
          }}>
            {isListening
              ? <><span style={{ width:7,height:7,background:RED,borderRadius:'50%',animation:'pulse 1.2s ease infinite',display:'inline-block' }}/>Stop</>
              : '⏺ Listen to singer'
            }
          </button>
        </div>

        {error && <p style={{ color:RED, fontSize:12, width:'100%' }}>{error}</p>}

        {/* Sensitivity slider */}
        <div style={{ width:'100%', display:'flex', alignItems:'center', gap:12, paddingTop: error ? 4 : 0 }}>
          <span style={{ fontSize:10, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.3)', flexShrink:0, letterSpacing:'.06em' }}>
            MIC GAIN
          </span>
          <input type="range" min={0.3} max={3.0} step={0.1} value={sensitivity}
            onChange={e => setSensitivity(parseFloat(e.target.value))}
            style={{ flex:1, accentColor: ACCENT, cursor:'pointer' }}
          />
          <span style={{ fontSize:10, fontFamily:'"DM Mono",monospace', color: sensitivity > 1.5 ? YELLOW : 'rgba(255,255,255,0.35)', minWidth:32, textAlign:'right' }}>
            {sensitivity > 2.4 ? 'Max' : sensitivity > 1.5 ? 'High' : sensitivity < 0.7 ? 'Low' : 'Med'}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:5, borderLeft:'0.5px solid rgba(255,255,255,0.08)', paddingLeft:12 }}>
            <div style={{
              width:8, height:8, borderRadius:'50%',
              background: signalQuality>0.5 ? ACCENT : signalQuality>0.25 ? YELLOW : RED,
              boxShadow: signalQuality>0.5 ? `0 0 6px ${ACCENT}99` : 'none',
              transition: 'background 0.3s',
            }}/>
            <span style={{ fontSize:10, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.3)' }}>
              {signalQuality>0.5 ? 'Good signal' : signalQuality>0.25 ? 'Weak signal' : 'No signal'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Live pitch display ── */}
      {isListening && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '1rem',
          display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap',
        }}>
          {/* Current note */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:60 }}>
            <span style={{ fontSize:9, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.25)', letterSpacing:'.1em', textTransform:'uppercase' }}>
              Singing now
            </span>
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{
                fontFamily:'"DM Serif Display",serif',
                fontSize: currentNote ? 44 : 36,
                color: pitchConfidence > 0.78 ? ACCENT : 'rgba(255,255,255,0.2)',
                lineHeight:1, transition:'color 0.2s',
              }}>
                {currentNote ? currentNote.replace(/[0-9]/g,'') : ':'}
              </span>
              {currentNote && (
                <span style={{ fontSize:16, fontFamily:'"DM Mono",monospace', color:'rgba(200,245,90,0.4)' }}>
                  {currentNote.match(/[0-9]+/)?.[0]}
                </span>
              )}
            </div>
            {currentFreq && (
              <span style={{ fontSize:10, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.25)' }}>
                {currentFreq} Hz
              </span>
            )}
          </div>

          {/* Tuner / pitch accuracy */}
          <div style={{ flex:1, minWidth:100 }}>
            <span style={{ fontSize:9, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.25)', letterSpacing:'.1em', textTransform:'uppercase', display:'block', marginBottom:8 }}>
              Pitch accuracy
            </span>
            <CentMeter cents={currentCents} />
          </div>

          {/* Volume */}
          <div>
            <span style={{ fontSize:9, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.25)', letterSpacing:'.1em', textTransform:'uppercase', display:'block', marginBottom:6 }}>
              Level
            </span>
            <VolumeBar volume={volume}/>
          </div>

          {/* Stats */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:11, fontFamily:'"DM Mono",monospace', color:'rgba(255,255,255,0.3)' }}>
            <span>⏱ {Math.floor(listenDuration/60)}:{String(listenDuration%60).padStart(2,'0')}</span>
            <span>♩ {notesHeard} notes</span>
            <span style={{ color: pitchConfidence>0.85?ACCENT:pitchConfidence>0.6?YELLOW:'rgba(255,255,255,0.3)' }}>
              {pitchConfidence>0.65?'✓ Clear':pitchConfidence>0.4?'~ Detecting':'○ Quiet'}
            </span>
          </div>
        </div>
      )}

      {/* ── Note trail ── */}
      {noteHistory.length > 0 && (
        <div style={{
          background:'rgba(255,255,255,0.02)', border:'0.5px solid rgba(255,255,255,0.07)',
          borderRadius:12, padding:'0.75rem 1rem',
        }}>
          <span style={{ fontSize:9,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase',display:'block',marginBottom:8 }}>
            Notes heard
          </span>
          <NoteTrail noteHistory={noteHistory}/>
        </div>
      )}

      {/* ── Data collection progress ── */}
      {isListening && dataStrength < 0.4 && (
        <div style={{
          background:'rgba(255,200,90,0.05)', border:'0.5px solid rgba(255,200,90,0.2)',
          borderRadius:12, padding:'0.875rem 1rem',
          display:'flex', alignItems:'center', gap:'1rem',
        }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:YELLOW, marginBottom:6 }}>
              {dataStrength < 0.08
                ? (signalQuality < 0.15 ? 'No signal detected : try raising Mic Gain ↑' : 'Waiting for the singer to start…')
                : dataStrength < 0.3
                ? 'Hearing the melody : keep going…'
                : 'Almost there : a few more bars…'
              }
            </div>
            <div style={{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${dataStrength*100}%`, background:YELLOW, borderRadius:2, transition:'width 0.5s ease' }}/>
            </div>
          </div>
          <span style={{ fontSize:11, fontFamily:'"DM Mono",monospace', color:YELLOW, flexShrink:0 }}>
            {Math.round(dataStrength*100)}%
          </span>
        </div>
      )}

      {/* ── Key result ── */}
      {keyResult && (
        <>
          {/* Main key card */}
          <div style={{
            background: 'rgba(200,245,90,0.05)',
            border: `1.5px solid rgba(200,245,90,${keyResult.confidence > 0.6 ? 0.30 : 0.12})`,
            borderRadius: 18, padding: '1.25rem',
            display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap',
          }}>
            <ConfRing value={keyResult.confidence}/>

            {/* Key name */}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:ACCENT,opacity:.55,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4 }}>
                Singer's Key
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontFamily:'"DM Serif Display",serif', fontSize:56, color:ACCENT, lineHeight:1 }}>
                  {keyResult.key}
                </span>
                <span style={{ fontFamily:'"DM Mono",monospace', fontSize:18, color:'rgba(200,245,90,0.6)' }}>
                  {keyResult.mode}
                </span>
              </div>
              <div style={{ fontSize:11,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.3)',marginTop:4 }}>
                {keyResult.confidenceLabel} confidence
                {keyResult.confidence < 0.55 && ' : sing more for better accuracy'}
              </div>
            </div>

            {/* Alternates */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <span style={{ fontSize:9,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase' }}>
                Also possible
              </span>
              {keyResult.alternates.map((alt,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ fontSize:12,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.4)' }}>
                    {alt.key} {alt.mode}
                  </span>
                  <div style={{ height:3,width:55,background:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${Math.round(alt.score*100)}%`,background:'rgba(255,255,255,0.2)',borderRadius:2 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Two column: wheel + chords to play ── */}
          <div style={{ display:'flex', gap:'1rem', alignItems:'flex-start', flexDirection:'column' }}>

            {/* Chromatic pitch wheel */}
            <div style={{
              background:'rgba(255,255,255,0.02)', border:'0.5px solid rgba(255,255,255,0.07)',
              borderRadius:14, padding:'1rem', flex:'0 0 auto',
            }}>
              <span style={{ fontSize:9,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase',display:'block',marginBottom:8 }}>
                Pitch distribution
              </span>
              <PitchWheel
                pitchAccum={pitchAccum}
                detectedRoot={keyResult.root}
                scale={keyResult.scale}
              />
            </div>

            {/* Chords to play */}
            <div style={{ flex:1, width:'100%', display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              <div style={{
                background:'rgba(255,255,255,0.02)', border:'0.5px solid rgba(255,255,255,0.07)',
                borderRadius:14, padding:'1rem',
              }}>
                <span style={{ fontSize:9,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase',display:'block',marginBottom:'0.875rem' }}>
                  Chords you can play to accompany
                </span>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {keyResult.scale.map((entry,i)=>(
                    <PlayChordCard key={i} entry={entry} highlight={i===0||i===3||i===4}/>
                  ))}
                </div>
                <p style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.2)',marginTop:'0.75rem',lineHeight:1.6 }}>
                  Highlighted: I, IV, V : the three primary chords. These alone will work for most songs.
                </p>
              </div>

              {/* Primary progression suggestion */}
              <div style={{
                background:'rgba(200,245,90,0.04)', border:'0.5px solid rgba(200,245,90,0.15)',
                borderRadius:14, padding:'1rem',
              }}>
                <span style={{ fontSize:9,fontFamily:'"DM Mono",monospace',color:ACCENT,opacity:.55,letterSpacing:'.08em',textTransform:'uppercase',display:'block',marginBottom:8 }}>
                  Try this progression to start
                </span>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  {[0,3,4,5].map((di,i)=>{
                    const entry = keyResult.scale[di]
                    if (!entry) return null
                    return (
                      <React.Fragment key={i}>
                        <span style={{ fontFamily:'"DM Serif Display",serif', fontSize:26, color:ACCENT }}>
                          {entry.chord}
                        </span>
                        {i<3 && <span style={{ color:'rgba(255,255,255,0.2)', fontSize:14 }}>→</span>}
                      </React.Fragment>
                    )
                  })}
                </div>
                <p style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.3)',marginTop:8 }}>
                  I → IV → V → vi : works for most pop, gospel, and folk melodies
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!keyResult && !isListening && (
        <div style={{
          border:'0.5px dashed rgba(255,255,255,0.08)', borderRadius:16,
          padding:'2.5rem', textAlign:'center', display:'flex', flexDirection:'column',
          alignItems:'center', gap:'0.875rem',
        }}>
          <span style={{ fontSize:36, opacity:.15 }}>🎤</span>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.3)', lineHeight:1.7, maxWidth:340 }}>
            Press "Listen to singer" and have the vocalist sing a few bars.<br/>
            The key will be detected from their melody automatically.
          </p>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.2)', fontFamily:'"DM Mono",monospace', lineHeight:1.6 }}>
            Works best with: clear vocals · minimal backing · 5–10 seconds of singing
          </p>
        </div>
      )}
    </div>
  )
}
