import VocalKeyFinder from './VocalKeyFinder'
import KeyDetectionPanel from './KeyDetectionPanel'
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { predictNextChords, SessionMarkov } from './chordPrediction'
import { getRomanNumeral } from './musicTheory'
import ChordDiagram from './ChordDiagram'
import { Chord } from 'tonal'

const ACCENT  = '#c8f55a'
const YELLOW  = '#ffc85a'
const BLUE    = '#6bb5ff'
const DIM     = 'rgba(255,255,255,0.35)'

// ── Source badge ──────────────────────────────────────────────────────────────
const SOURCE_LABELS = {
  session: { label: 'You played this before', color: ACCENT },
  pattern: { label: 'Recent pattern',         color: YELLOW },
  harmony: { label: 'Music theory',           color: BLUE   },
  circle:  { label: 'Circle of fifths',       color: DIM    },
}

function SourceBadge({ source }) {
  const { label, color } = SOURCE_LABELS[source] || SOURCE_LABELS.circle
  return (
    <span style={{
      fontSize: 9, fontFamily: '"DM Mono", monospace',
      color, opacity: 0.75, letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  )
}

// ── Probability bar ───────────────────────────────────────────────────────────
function ProbBar({ value, color }) {
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%',
        width: `${Math.round(value * 100)}%`,
        background: color,
        borderRadius: 2,
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

// ── Single predicted chord card ───────────────────────────────────────────────
function PredictionCard({ prediction, rank, keyRoot, simplifyFn, isMobile = false }) {
  const { chord, probability, source } = prediction
  const displayChord = simplifyFn ? simplifyFn(chord) : chord
  const roman = keyRoot ? getRomanNumeral(chord, keyRoot) : null
  const rootMatch = displayChord.match(/^([A-G][#b]?)(.*)$/)
  const root = rootMatch?.[1] || displayChord
  const quality = rootMatch?.[2] || ''

  const colors = [ACCENT, YELLOW, BLUE]
  const color = colors[rank] || DIM

  const notes = useMemo(() => {
    try {
      const info = Chord.get(chord)
      return info.empty ? [] : (info.notes || [])
    } catch { return [] }
  }, [chord])

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: rank === 0 ? 'rgba(200,245,90,0.04)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${rank === 0 ? 'rgba(200,245,90,0.20)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 16,
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 9, fontFamily: '"DM Mono", monospace',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color,
        }}>
          {rank === 0 ? '★ Most likely' : rank === 1 ? '· Also try' : '· Or try'}
        </span>
        {roman && (
          <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color, opacity: 0.6 }}>
            {roman.label}
          </span>
        )}
      </div>

      {/* Chord name */}
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <span style={{ fontFamily: '"DM Serif Display", serif', color, lineHeight: 1 }}>
          <span style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>{root}</span>
          {quality && <span style={{ fontSize: 'clamp(18px, 2.2vw, 26px)', opacity: 0.8 }}>{quality}</span>}
        </span>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
          {notes.map((n, i) => (
            <span key={i} style={{
              fontSize: 10, fontFamily: '"DM Mono", monospace',
              color, opacity: 0.75,
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 5, padding: '1px 6px',
            }}>{n}</span>
          ))}
        </div>
      )}

      {/* Piano diagram */}
      {!isMobile && <ChordDiagram chordName={chord} dim={rank > 0} />}

      {/* Probability bar + source */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SourceBadge source={source} />
          <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color, opacity: 0.7 }}>
            {Math.round(probability * 100)}%
          </span>
        </div>
        <ProbBar value={probability} color={color} />
      </div>
    </div>
  )
}

// ── Key selector ──────────────────────────────────────────────────────────────
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function KeySelector({ keyRoot, keyMode, onKeyRoot, onKeyMode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '0.875rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
        Key
      </span>

      {/* Note buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {NOTES.map(note => (
          <button key={note} onClick={() => onKeyRoot(keyRoot === note ? null : note)}
            style={{
              padding: '4px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              fontFamily: '"DM Mono", monospace',
              background: keyRoot === note ? '#c8f55a' : 'rgba(255,255,255,0.05)',
              color: keyRoot === note ? '#0a0a0f' : 'rgba(255,255,255,0.45)',
              border: keyRoot === note ? 'none' : '0.5px solid rgba(255,255,255,0.09)',
              fontWeight: keyRoot === note ? 600 : 400,
              transition: 'all 0.12s',
            }}>
            {note}
          </button>
        ))}
      </div>

      {/* Major / Minor */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3, gap: 2 }}>
        {['major', 'minor'].map(m => (
          <button key={m} onClick={() => onKeyMode(m)}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              fontFamily: '"DM Mono", monospace',
              background: keyMode === m ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: keyMode === m ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid transparent',
              color: keyMode === m ? '#f0f0f5' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.12s',
            }}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {!keyRoot && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: '"DM Mono", monospace' }}>
          Select key for better predictions
        </span>
      )}
    </div>
  )
}

// ── Main LiveMicView ──────────────────────────────────────────────────────────
export default function LiveMicView({
  isMobile = false,
  isListening, startMic, stopMic,
  currentChord, chordHistory,
  volume, error,
  simplified, simplifyFn,
  pitchClassAccum,
}) {
  const [keyRoot, setKeyRoot] = useState(null)
  const [keyMode, setKeyMode] = useState('major')
  const markovRef = useRef(new SessionMarkov())
  const [activeTab, setActiveTab] = useState('predict') // 'predict' | 'key'
  const prevChordRef = useRef(null)

  // Record transitions into the Markov model as chords change
  useEffect(() => {
    if (!currentChord) return
    if (prevChordRef.current && prevChordRef.current !== currentChord) {
      markovRef.current.record(prevChordRef.current, currentChord)
    }
    prevChordRef.current = currentChord
  }, [currentChord])

  // Auto-detect key from chord history if none set
  useEffect(() => {
    if (keyRoot || chordHistory.length < 6) return
    // Most frequent root in recent history = likely tonic
    const counts = {}
    chordHistory.slice(0, 20).forEach(({ chord }) => {
      const root = chord?.match(/^([A-G][#b]?)/)?.[1]
      if (root) counts[root] = (counts[root] || 0) + 1
    })
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (best && best[1] >= 3) setKeyRoot(best[0])
  }, [chordHistory.length])

  // Predictions
  const predictions = useMemo(() => {
    if (!currentChord) return []
    return predictNextChords(
      currentChord,
      chordHistory,
      keyRoot,
      keyMode,
      markovRef.current,
      3,
    )
  }, [currentChord, chordHistory, keyRoot, keyMode])

  const displayCurrent = simplifyFn ? simplifyFn(currentChord) : currentChord
  const currentRoman = keyRoot && currentChord ? getRomanNumeral(currentChord, keyRoot, keyMode) : null

  const rootMatch = displayCurrent?.match(/^([A-G][#b]?)(.*)$/)
  const currentRoot = rootMatch?.[1] || displayCurrent
  const currentQuality = rootMatch?.[2] || ''

  const currentNotes = useMemo(() => {
    if (!currentChord) return []
    try { const i = Chord.get(currentChord); return i.empty ? [] : i.notes || [] } catch { return [] }
  }, [currentChord])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Mic controls bar ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '0.75rem 1rem',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        <button onClick={isListening ? stopMic : startMic} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 20px', borderRadius: 10, cursor: 'pointer',
          background: isListening ? 'rgba(255,107,107,0.12)' : '#c8f55a',
          color: isListening ? '#ff6b6b' : '#0a0a0f',
          border: isListening ? '0.5px solid rgba(255,107,107,0.3)' : 'none',
          fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
          flexShrink: 0,
        }}>
          {isListening
            ? <><span style={{ width: 7, height: 7, background: '#ff6b6b', borderRadius: '50%', animation: 'pulse 1.2s ease infinite', display: 'inline-block' }} />Stop</>
            : '⏺ Start listening'
          }
        </button>

        {/* Volume meter */}
        {isListening && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 20, width: 100, flexShrink: 0 }}>
            {Array.from({ length: 18 }, (_, i) => {
              const active = i < Math.round(volume * 18)
              return <div key={i} style={{
                flex: 1, height: `${35 + (i / 18) * 65}%`,
                background: active ? (i < 11 ? '#c8f55a' : i < 15 ? '#f5c84a' : '#ff6b6b') : 'rgba(255,255,255,0.07)',
                borderRadius: 1, transition: 'background 0.05s',
              }} />
            })}
          </div>
        )}

        {isListening && (
          <span style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: '#c8f55a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, background: '#c8f55a', borderRadius: '50%', animation: 'pulse 1.2s ease infinite', display: 'inline-block' }} />
            Listening
          </span>
        )}

        {error && <p style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</p>}

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.7, fontFamily: '"DM Mono", monospace' }}>
          <p>→ Hold each chord 2–3s for detection</p>
          <p>→ Use headphones to avoid feedback</p>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display:'flex',background:'rgba(255,255,255,0.04)',borderRadius:10,padding:3,gap:2 }}>
        {[
          { id:'predict', label: isMobile ? '🎹 Predict' : '🎹  Predictions' },
          { id:'key',     label: isMobile ? '♩ Key' : '♩  Key Detection' },
          { id:'vocal',   label: isMobile ? '🎤 Singer' : '🎤  Singer\'s Key' },
        ].map(({id,label})=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{
            flex:1,padding:'7px 0',borderRadius:8,fontSize:12,cursor:'pointer',
            fontFamily:'"DM Sans",sans-serif',fontWeight:activeTab===id?600:400,
            background:activeTab===id?'rgba(255,255,255,0.10)':'transparent',
            border:activeTab===id?'0.5px solid rgba(255,255,255,0.15)':'0.5px solid transparent',
            color:activeTab===id?'#f0f0f5':'rgba(255,255,255,0.35)',
            transition:'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {activeTab==='key' && (
        <KeyDetectionPanel
          pitchClassAccum={pitchClassAccum}
          chordHistory={chordHistory}
          currentChord={currentChord}
        />
      )}

      {activeTab==='vocal' && (
        <VocalKeyFinder />
      )}

      {activeTab==='predict' && (<>

      {/* ── Key selector ── */}
      <KeySelector keyRoot={keyRoot} keyMode={keyMode} onKeyRoot={setKeyRoot} onKeyMode={setKeyMode} />

      {/* ── NOW playing + predictions ── */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'stretch', flexDirection: isMobile ? 'column' : 'row' }}>

        {/* Current chord (tall card) */}
        <div style={{
          width: isMobile ? '100%' : 220, flexShrink: 0,
          background: currentChord ? 'rgba(200,245,90,0.05)' : 'rgba(255,255,255,0.02)',
          border: `1.5px solid ${currentChord ? 'rgba(200,245,90,0.25)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 18,
          padding: '1.25rem',
          display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'stretch', gap: '0.75rem',
        }}>
          <span style={{
            fontSize: 10, fontFamily: '"DM Mono", monospace',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#c8f55a', fontWeight: 700,
          }}>
            ▶ Now playing
          </span>

          <div style={{ textAlign: 'center', lineHeight: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {!currentChord ? (
              <span style={{ fontSize: 48, fontFamily: '"DM Serif Display", serif', color: 'rgba(255,255,255,0.15)' }}>:</span>
            ) : (
              <>
                <span style={{ fontFamily: '"DM Serif Display", serif', color: '#c8f55a', lineHeight: 1 }}>
                  <span style={{ fontSize: 58 }}>{currentRoot}</span>
                  {currentQuality && <span style={{ fontSize: 32, opacity: 0.8 }}>{currentQuality}</span>}
                </span>
                {currentRoman && (
                  <span style={{ fontSize: 12, fontFamily: '"DM Mono", monospace', color: 'rgba(200,245,90,0.5)', marginTop: 4 }}>
                    {currentRoman.label}
                  </span>
                )}
              </>
            )}
          </div>

          {currentNotes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
              {currentNotes.map((n, i) => (
                <span key={i} style={{
                  fontSize: 11, fontFamily: '"DM Mono", monospace',
                  color: '#c8f55a', background: 'rgba(200,245,90,0.10)',
                  border: '0.5px solid rgba(200,245,90,0.22)',
                  borderRadius: 6, padding: '2px 7px',
                }}>{n}</span>
              ))}
            </div>
          )}

          <ChordDiagram chordName={currentChord} dim={false} />
        </div>

        {/* Predictions */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: 10, fontFamily: '"DM Mono", monospace',
              letterSpacing: '0.10em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
            }}>
              → Predicted next chords
            </span>
            {predictions.length > 0 && (
              <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.2)' }}>
                {markovRef.current.totalObservations >= 3
                  ? 'Learning your patterns…'
                  : 'Play more to improve predictions'}
              </span>
            )}
          </div>

          {/* Prediction cards */}
          {predictions.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
              {predictions.map((p, i) => (
                <PredictionCard key={p.chord + i} prediction={p} rank={i} keyRoot={keyRoot} simplifyFn={simplifyFn} isMobile={isMobile} />
              ))}
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              border: '0.5px dashed rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '2rem', gap: '0.75rem', textAlign: 'center',
            }}>
              <span style={{ fontSize: 28, opacity: 0.2 }}>♩</span>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6, maxWidth: 260 }}>
                {!isListening
                  ? 'Start listening and play a chord to get predictions'
                  : !currentChord
                  ? 'Play a chord on your piano…'
                  : 'Select a key above for harmony-based predictions'}
              </p>
            </div>
          )}
        </div>
      </div>

      </>) /* end predict tab */}

      {/* ── Chord history strip ── */}
      {chordHistory.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '0.5px solid rgba(255,255,255,0.07)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Recent chords
            </span>
            <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.2)' }}>
              {chordHistory.length} played · {markovRef.current.totalObservations} transitions learned
            </span>
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', padding: '0.625rem 0.875rem', gap: 5, scrollbarWidth: 'none' }}>
            {[...chordHistory].slice(0, 30).map((entry, i) => {
              const isLatest = i === 0
              const roman = keyRoot ? getRomanNumeral(entry.chord, keyRoot, keyMode) : null
              return (
                <div key={i} style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 9,
                  background: isLatest ? 'rgba(200,245,90,0.10)' : 'rgba(255,255,255,0.03)',
                  border: isLatest ? '1px solid rgba(200,245,90,0.28)' : '0.5px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  {roman && (
                    <span style={{ fontSize: 8, fontFamily: '"DM Mono", monospace', color: isLatest ? 'rgba(200,245,90,0.55)' : 'rgba(255,255,255,0.2)' }}>
                      {roman.label}
                    </span>
                  )}
                  <span style={{
                    fontFamily: '"DM Mono", monospace', fontSize: 13,
                    color: isLatest ? '#c8f55a' : 'rgba(255,255,255,0.45)',
                    fontWeight: isLatest ? 600 : 400,
                  }}>
                    {simplifyFn ? simplifyFn(entry.chord) : entry.chord}
                  </span>
                  <span style={{ fontSize: 8, fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.2)' }}>
                    {entry.time}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
