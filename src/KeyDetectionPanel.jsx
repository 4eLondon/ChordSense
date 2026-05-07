import React, { useMemo, useState } from 'react'
import { detectKey, buildScale, getMovementsForChord } from './keyDetection'

const ACCENT = 'var(--accent)'
const BLUE   = 'var(--blue)'
const YELLOW = 'var(--yellow)'
const DIM    = 'var(--text3)'
const DIM2   = 'rgba(255,255,255,0.12)'

// Chord quality → color
function qualityColor(q) {
  if (!q) return DIM
  if (q==='dim')  return '#ff6b6b'
  if (q==='dom7') return '#ffa55a'
  if (q==='min')  return BLUE
  return ACCENT
}

// ── Confidence ring ───────────────────────────────────────────────────────────
function ConfidenceRing({ value, label }) {
  const r = 28, stroke = 5
  const circ = 2 * Math.PI * r
  const filled = circ * value
  return (
    <div style={{ position:'relative', width:70, height:70, flexShrink:0 }}>
      <svg width={70} height={70} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
        <circle cx={35} cy={35} r={r} fill="none"
          stroke={value>=0.75 ? ACCENT : value>=0.5 ? YELLOW : '#ff6b6b'}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
        <span style={{ fontSize:13,fontWeight:700,color:value>=0.75?ACCENT:value>=0.5?YELLOW:'#ff6b6b',fontFamily:'"DM Mono",monospace' }}>
          {Math.round(value*100)}%
        </span>
      </div>
    </div>
  )
}

// ── Scale degree pill ─────────────────────────────────────────────────────────
function DegreePill({ entry, isRoot, isCurrent, onClick }) {
  const color = qualityColor(entry.quality)
  return (
    <button onClick={onClick} style={{
      display:'flex',flexDirection:'column',alignItems:'center',gap:3,
      padding:'10px 12px',borderRadius:12,cursor:'pointer',
      background: isCurrent ? `${color}22` : isRoot ? `${color}14` : 'rgba(255,255,255,0.03)',
      border:`${isCurrent?'1.5':'0.5'}px solid ${isCurrent?color:isRoot?`${color}55`:'rgba(255,255,255,0.08)'}`,
      transition:'all 0.15s',minWidth:56,
    }}>
      <span style={{ fontSize:9,fontFamily:'"DM Mono",monospace',color:isCurrent?color:'rgba(255,255,255,0.3)',letterSpacing:'0.06em' }}>
        {entry.roman}
      </span>
      <span style={{ fontSize:16,fontFamily:'"DM Serif Display",serif',color:isCurrent?color:isRoot?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.55)', fontWeight:isCurrent||isRoot?600:400 }}>
        {entry.chord}
      </span>
      <span style={{ fontSize:8,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.2)',textTransform:'uppercase' }}>
        {entry.quality}
      </span>
    </button>
  )
}

// ── Movement card ─────────────────────────────────────────────────────────────
function MovementCard({ move }) {
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,
      padding:'8px 12px',borderRadius:10,
      background:'var(--surface)',
      border:'0.5px solid var(--border)',
    }}>
      <span style={{ fontSize:18,fontFamily:'"DM Serif Display",serif',color:ACCENT,minWidth:40,textAlign:'center' }}>
        {move.targetChord}
      </span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11,color:'rgba(255,255,255,0.6)',fontFamily:'"DM Mono",monospace',marginBottom:2 }}>
          → {move.label}
        </div>
        <div style={{ fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'"DM Sans",sans-serif' }}>
          {move.desc}
        </div>
      </div>
    </div>
  )
}

// ── Pitch class histogram bar ─────────────────────────────────────────────────
function PitchHistogram({ pcEnergy, scale }) {
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  const max = Math.max(...pcEnergy, 1)
  const scalePCs = new Set(scale?.map(s=>s.pc) || [])
  const rootPc = scale?.[0]?.pc

  return (
    <div style={{ display:'flex',gap:3,alignItems:'flex-end',height:40 }}>
      {Array.from({length:12},(_,i)=>{
        const val = pcEnergy[i] || 0
        const h = Math.max(4, (val/max)*100)
        const inScale = scalePCs.has(i)
        const isRoot  = i===rootPc
        return (
          <div key={i} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2 }}>
            <div style={{
              width:'100%',height:`${h}%`,
              background: isRoot  ? ACCENT
                        : inScale ? 'rgba(200,245,90,0.45)'
                        : 'rgba(255,255,255,0.10)',
              borderRadius:'2px 2px 0 0',
              transition:'height 0.3s ease',minHeight:3,
            }}/>
            <span style={{ fontSize:7,fontFamily:'"DM Mono",monospace',color:isRoot?ACCENT:inScale?'rgba(200,245,90,0.5)':'rgba(255,255,255,0.2)' }}>
              {NOTE_NAMES[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function KeyDetectionPanel({ pitchClassAccum, chordHistory, currentChord }) {
  const [selectedDegree, setSelectedDegree] = useState(null) // which scale degree to show movements for

  const result = useMemo(()=>{
    const hasAudio = [...pitchClassAccum].some(v=>v>0)
    if (!hasAudio && chordHistory.length===0) return null
    return detectKey(pitchClassAccum, chordHistory)
  },[pitchClassAccum, chordHistory])

  // Find current chord's degree in the detected scale
  const currentDegree = useMemo(()=>{
    if (!result || !currentChord) return null
    const m = currentChord.match(/^([A-G][#b]?)/)
    if (!m) return null
    const rootNote = m[1].replace('Bb','A#').replace('Eb','D#').replace('Ab','G#')
                          .replace('Db','C#').replace('Gb','F#')
    const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    const pc = NOTE_NAMES.indexOf(rootNote)
    return result.scale.find(s=>s.pc===pc) || null
  },[result, currentChord])

  // Auto-select current chord degree for movement display
  const activeDegree = selectedDegree ?? currentDegree

  const movements = useMemo(()=>{
    if (!result || !activeDegree) return []
    return getMovementsForChord(activeDegree.chord, result.scale)
  },[result, activeDegree])

  if (!result) return (
    <div style={{
      background:'var(--bg3)',border:'0.5px solid var(--border)',
      borderRadius:16,padding:'2rem',textAlign:'center',
    }}>
      <p style={{ fontSize:28,opacity:.15,marginBottom:12 }}>♩</p>
      <p style={{ fontSize:13,color:'rgba(255,255,255,0.25)',lineHeight:1.6 }}>
        Play some chords or notes and the key will be detected automatically
      </p>
    </div>
  )

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>

      {/* ── Key result card ── */}
      <div style={{
        background:'rgba(200,245,90,0.04)',border:'1px solid rgba(200,245,90,0.18)',
        borderRadius:18,padding:'1.25rem',
        display:'flex',gap:'1.25rem',alignItems:'center',flexWrap:'wrap',
      }}>
        {/* Confidence ring */}
        <ConfidenceRing value={result.confidence} label={result.confidenceLabel}/>

        {/* Key name */}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:ACCENT,opacity:.6,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4 }}>
            Detected Key
          </div>
          <div style={{ display:'flex',alignItems:'baseline',gap:10 }}>
            <span style={{ fontFamily:'"DM Serif Display",serif',fontSize:52,color:ACCENT,lineHeight:1 }}>
              {result.key}
            </span>
            <span style={{ fontFamily:'"DM Mono",monospace',fontSize:16,color:'rgba(200,245,90,0.65)' }}>
              {result.mode}
            </span>
          </div>
          <div style={{ fontSize:11,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.3)',marginTop:4 }}>
            {result.confidenceLabel} confidence
          </div>
        </div>

        {/* Alternate keys */}
        <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
          <span style={{ fontSize:9,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase' }}>
            Also possible
          </span>
          {result.alternates.map((alt,i)=>(
            <div key={i} style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:13,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.45)' }}>
                {alt.key} {alt.mode}
              </span>
              <div style={{ height:3,width:60,background:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${Math.round(alt.score*100)}%`,background:'rgba(255,255,255,0.25)',borderRadius:2 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pitch histogram ── */}
      <div style={{ background:'var(--bg3)',border:'0.5px solid var(--border)',borderRadius:14,padding:'1rem' }}>
        <div style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'0.75rem',display:'flex',justifyContent:'space-between' }}>
          <span>Pitch energy</span>
          <span style={{ color:'rgba(200,245,90,0.4)' }}>■ in scale &nbsp; <span style={{ color:ACCENT }}>■ root</span></span>
        </div>
        <PitchHistogram pcEnergy={pitchClassAccum} scale={result.scale}/>
      </div>

      {/* ── Scale degrees (clickable) ── */}
      <div style={{ background:'var(--bg3)',border:'0.5px solid var(--border)',borderRadius:14,padding:'1rem' }}>
        <div style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'0.875rem' }}>
          Scale — click a chord to see likely movements
        </div>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          {result.scale.map((entry,i)=>(
            <DegreePill
              key={i}
              entry={entry}
              isRoot={i===0}
              isCurrent={currentDegree?.pc===entry.pc}
              onClick={()=>setSelectedDegree(selectedDegree?.pc===entry.pc ? null : entry)}
            />
          ))}
        </div>
        {currentDegree && !selectedDegree && (
          <p style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',marginTop:8 }}>
            Showing movements for <span style={{ color:ACCENT }}>{currentDegree.chord}</span> ({currentDegree.roman}) — the chord you're playing now
          </p>
        )}
        {selectedDegree && (
          <p style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',marginTop:8 }}>
            Showing movements for <span style={{ color:ACCENT }}>{selectedDegree.chord}</span> ({selectedDegree.roman}) — <button onClick={()=>setSelectedDegree(null)} style={{ color:YELLOW,background:'none',border:'none',cursor:'pointer',fontSize:10,fontFamily:'inherit',padding:0 }}>reset</button>
          </p>
        )}
      </div>

      {/* ── Likely movements ── */}
      {movements.length > 0 && (
        <div style={{ background:'var(--bg3)',border:'0.5px solid var(--border)',borderRadius:14,padding:'1rem' }}>
          <div style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(255,255,255,0.25)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'0.875rem' }}>
            From {activeDegree?.chord} ({activeDegree?.roman}) — likely next chords
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
            {movements.map((mv,i)=><MovementCard key={i} move={mv}/>)}
          </div>
        </div>
      )}

    </div>
  )
}
