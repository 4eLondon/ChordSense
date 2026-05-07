import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useTheme } from './useTheme'
import ThemeSettings from './ThemeSettings'
import { useAudioEngine, simplifyChord } from './useAudioEngine'
import { getNextChord, getCurrentChordFromTimeline, chordMatchesFilter } from './musicTheory'
import { useBreakpoint } from './useBreakpoint'
import NowNextCards from './NowNextCards'
import RulerTimeline from './RulerTimeline'
import FilterPills from './FilterPills'
import SaveModal from './SaveModal'
import LiveMicView from './LiveMicView'
import InstallPrompt from './InstallPrompt'

function formatTime(s) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export default function App() {
  const { isMobile, isTablet } = useBreakpoint()
  const { themeId, setThemeId, accentId, setAccentId, fontSizeId, setFontSizeId, isLight } = useTheme()

  const {
    isListening, startMic, stopMic,
    pitchClassAccum,
    isAnalyzingFile, fileProgress, analyzeFile,
    fileChordTimeline, songKey, bpm,
    isPlaying, playbackTime, duration, togglePlayback, seekTo,
    currentChord: rawCurrentChord,
    detectedNotes, chordHistory,
    volume, error,
  } = useAudioEngine()

  const [mode, setMode] = useState('file')
  const [simplified, setSimplified] = useState(false)
  const [filterId, setFilterId] = useState('all')
  const [smoothing, setSmoothing] = useState('smooth')
  const [showSave, setShowSave] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const [showControls, setShowControls] = useState(false) // mobile: show extra controls
  const fileInputRef = useRef(null)

  const display = useCallback(c => simplified ? simplifyChord(c) : c, [simplified])

  const MIN_DURATION = { raw: 0, smooth: 0.8, clean: 2.0 }

  const mergeShortChords = useCallback((timeline, minDuration) => {
    if (!timeline.length || minDuration <= 0) return timeline
    const merged = [...timeline]
    let changed = true
    while (changed) {
      changed = false
      for (let i = 1; i < merged.length; i++) {
        const nextTime = merged[i + 1]?.time ?? duration
        const dur = nextTime - merged[i].time
        if (dur < minDuration) { merged.splice(i, 1); changed = true; break }
      }
    }
    return merged
  }, [duration])

  const smoothedTimeline = useMemo(() => {
    const minDur = MIN_DURATION[smoothing] || 0
    const base = minDur > 0 ? mergeShortChords(fileChordTimeline, minDur) : fileChordTimeline
    if (filterId === 'all') return base
    return base.filter(e => chordMatchesFilter(e.chord, filterId, songKey))
  }, [fileChordTimeline, smoothing, filterId, songKey, mergeShortChords])

  const currentChord = useMemo(() => {
    if (mode === 'file' && smoothedTimeline.length > 0)
      return getCurrentChordFromTimeline(smoothedTimeline, playbackTime)?.chord || null
    return rawCurrentChord
  }, [mode, smoothedTimeline, playbackTime, rawCurrentChord])

  const nextEntry = useMemo(() => {
    if (mode !== 'file' || !smoothedTimeline.length) return null
    return getNextChord(smoothedTimeline, playbackTime, filterId, songKey)
  }, [mode, smoothedTimeline, playbackTime, filterId, songKey])

  const handleFile = useCallback((file) => {
    if (!file) return
    if (!file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i) && !file.type.startsWith('audio/')) {
      alert('Please upload an audio file (mp3, wav, flac, etc.)'); return
    }
    setFileName(file.name)
    analyzeFile(file)
  }, [analyzeFile])

  const hasFile = !!fileName && !isAnalyzingFile
  const pct = duration > 0 ? (playbackTime / duration) * 100 : 0

  // Responsive values
  const px = isMobile ? '0.875rem' : '1.5rem'
  const gap = isMobile ? '0.875rem' : '1.25rem'

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', fontFamily:'var(--font-body)', color:'var(--text)' }}>

      {/* ── HEADER ── */}
      <header style={{
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(14px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Row 1: logo + mode + essential actions */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
          gap: isMobile ? 8 : 12,
        }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:7, marginRight:'auto' }}>
            <span style={{ fontSize:18, color:'#c8f55a' }}>♪</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize: isMobile ? 17 : 20, letterSpacing:'-0.02em' }}>
              ChordSense
            </span>
          </div>

          {/* Mode toggle — always visible */}
          <div style={{ display:'flex', background:'var(--bg3)', borderRadius:9, padding:3, gap:2 }}>
            {[{ id:'file', label: isMobile ? '♫' : '♫ Song file' },
              { id:'mic',  label: isMobile ? '🎙' : '🎙 Live mic'  }].map(({ id, label }) => (
              <button key={id}
                onClick={() => { setMode(id); if (isListening) stopMic() }}
                style={{
                  padding: isMobile ? '6px 14px' : '5px 14px',
                  borderRadius:7, fontSize: isMobile ? 14 : 12, cursor:'pointer',
                  background: mode===id ? 'rgba(255,255,255,0.10)' : 'transparent',
                  border: mode===id ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid transparent',
                  color: mode===id ? '#f0f0f5' : 'rgba(255,255,255,0.4)',
                  minHeight: isMobile ? 36 : 'auto',
                  transition: 'all 0.15s',
                }}>{label}</button>
            ))}
          </div>

          {/* Song key pill — mobile only, space-saving */}
          {isMobile && songKey && (
            <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'#c8f55a',
              background:'rgba(200,245,90,0.10)', border:'0.5px solid rgba(200,245,90,0.25)',
              borderRadius:7, padding:'4px 9px', flexShrink:0 }}>
              {songKey}
            </span>
          )}

          {/* Controls toggle on mobile */}
          {isMobile ? (
            <button onClick={() => setShowControls(s => !s)} style={{
              width:36, height:36, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center',
              background: showControls ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
              border:'0.5px solid rgba(255,255,255,0.10)',
              color: showControls ? '#f0f0f5' : 'rgba(255,255,255,0.45)',
            }}>
              {/* Hamburger / X */}
              {showControls
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
              }
            </button>
          ) : (
            /* Desktop: filter + simplify + smoothing inline */
            <>
              <FilterPills activeId={filterId} onChange={setFilterId} keyRoot={songKey} />
              <button onClick={() => setSimplified(s => !s)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer',
                background: simplified ? 'rgba(200,245,90,0.10)' : 'rgba(255,255,255,0.05)',
                border:`0.5px solid ${simplified ? 'rgba(200,245,90,0.30)' : 'rgba(255,255,255,0.10)'}`,
                color: simplified ? '#c8f55a' : 'rgba(255,255,255,0.4)',
                fontFamily:'var(--font-mono)', transition:'all 0.15s',
              }}>{simplified ? '✦ Simple' : '✧ Simplify'}</button>
              <div style={{ display:'flex', background:'var(--bg3)', borderRadius:9, padding:3, gap:2 }}>
                {[['raw','Raw'],['smooth','Smooth'],['clean','Clean']].map(([id, label]) => (
                  <button key={id} onClick={() => setSmoothing(id)} style={{
                    padding:'5px 11px', borderRadius:7, fontSize:12, cursor:'pointer',
                    background: smoothing===id ? 'rgba(255,255,255,0.10)' : 'transparent',
                    border: smoothing===id ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid transparent',
                    color: smoothing===id ? '#f0f0f5' : 'rgba(255,255,255,0.3)',
                    transition:'all 0.15s', fontFamily:'"DM Mono",monospace',
                  }}>{label}</button>
                ))}
              </div>
              {songKey && (
                <div style={{ display:'flex', gap:12, paddingLeft:8, borderLeft:'0.5px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.4)' }}>
                    Key <span style={{ color:'#c8f55a' }}>{songKey}</span>
                  </span>
                  {bpm && <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.4)' }}>
                    {bpm}<span style={{ opacity:.5 }}> bpm</span>
                  </span>}
                </div>
              )}
              {chordHistory.length > 0 && (
                <button onClick={() => setShowSave(true)} style={{
                  padding:'5px 14px', borderRadius:8, fontSize:12, cursor:'pointer',
                  background:'rgba(200,245,90,0.10)', color:'var(--accent)',
                  border:'0.5px solid rgba(200,245,90,0.25)',
                }}>Save</button>
              )}
              {/* Theme settings button */}
              <button onClick={() => setShowTheme(true)} title="Appearance" style={{
                width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
                background:'var(--surface)', border:'0.5px solid var(--border2)',
                color:'var(--text2)', cursor:'pointer', flexShrink:0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Row 2 (mobile only): controls drawer */}
        {isMobile && showControls && (
          <div style={{
            borderTop: '0.5px solid var(--border)',
            padding: '0.75rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.625rem',
          }}>
            {/* Row: filter + simplify */}
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <FilterPills activeId={filterId} onChange={setFilterId} keyRoot={songKey} />
              <button onClick={() => setSimplified(s => !s)} style={{
                padding:'6px 12px', borderRadius:8, fontSize:12, cursor:'pointer',
                background: simplified ? 'rgba(200,245,90,0.10)' : 'rgba(255,255,255,0.05)',
                border:`0.5px solid ${simplified ? 'rgba(200,245,90,0.30)' : 'rgba(255,255,255,0.10)'}`,
                color: simplified ? '#c8f55a' : 'rgba(255,255,255,0.4)',
                fontFamily:'var(--font-mono)',
              }}>{simplified ? '✦ Simple' : '✧ Simplify'}</button>
              {chordHistory.length > 0 && (
                <button onClick={() => setShowSave(true)} style={{
                  padding:'6px 12px', borderRadius:8, fontSize:12, cursor:'pointer',
                  background:'rgba(200,245,90,0.10)', color:'var(--accent)',
                  border:'0.5px solid rgba(200,245,90,0.25)',
                }}>Save</button>
              )}
              <button onClick={() => setShowTheme(true)} style={{
                width:36, height:36, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center',
                background:'var(--surface)', border:'0.5px solid var(--border2)',
                color:'var(--text2)', cursor:'pointer', marginLeft:'auto',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              </button>
            </div>
            {/* Row: smoothing + bpm */}
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ display:'flex', background:'var(--bg3)', borderRadius:9, padding:3, gap:2 }}>
                {[['raw','Raw'],['smooth','Smooth'],['clean','Clean']].map(([id, label]) => (
                  <button key={id} onClick={() => setSmoothing(id)} style={{
                    padding:'5px 12px', borderRadius:7, fontSize:12, cursor:'pointer',
                    background: smoothing===id ? 'rgba(255,255,255,0.10)' : 'transparent',
                    border: smoothing===id ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid transparent',
                    color: smoothing===id ? '#f0f0f5' : 'rgba(255,255,255,0.3)',
                    fontFamily:'"DM Mono",monospace',
                  }}>{label}</button>
                ))}
              </div>
              {bpm && <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.3)', marginLeft:'auto' }}>
                {bpm}<span style={{ opacity:.5 }}> bpm</span>
              </span>}
            </div>
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT ── */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        padding: isMobile ? `${gap} 0.875rem` : `${gap} ${px}`,
        gap, maxWidth:1100, width:'100%', margin:'0 auto', boxSizing:'border-box',
      }}>

        {/* FILE MODE */}
        {mode === 'file' && (
          <>
            {!hasFile && !isAnalyzingFile && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex:1, display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center',
                  border:`1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border2)'}`,
                  borderRadius:20,
                  padding: isMobile ? '2rem 1.25rem' : '3rem',
                  cursor:'pointer', background: dragOver ? 'rgba(200,245,90,0.03)' : 'transparent',
                  transition:'all 0.2s', gap:'1rem', minHeight: isMobile ? 280 : 'auto',
                }}
              >
                <input ref={fileInputRef} type="file" accept="audio/*" style={{ display:'none' }}
                  onChange={e => handleFile(e.target.files[0])} />
                <div style={{ fontSize:36, opacity:.3 }}>♫</div>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize: isMobile ? 15 : 16, color:'rgba(255,255,255,0.6)', marginBottom:6 }}>
                    {isMobile ? 'Tap to choose a song' : 'Drop a song here to get started'}
                  </p>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>MP3, WAV, FLAC, M4A</p>
                </div>
                <div style={{ padding:'10px 24px', borderRadius:12, background:'var(--accent)', color:'var(--bg)', fontSize:13, fontWeight:600 }}>
                  Browse files
                </div>
              </div>
            )}

            {isAnalyzingFile && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1.5rem' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize: isMobile ? 24 : 32, color:'rgba(255,255,255,0.6)' }}>Analyzing song…</div>
                <div style={{ width:'100%', maxWidth:400 }}>
                  <div style={{ height:6, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${fileProgress}%`, background:'var(--accent)', borderRadius:3, transition:'width 0.3s ease' }} />
                  </div>
                  <p style={{ textAlign:'center', marginTop:10, fontSize:12, color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-mono)' }}>
                    {fileProgress}% · {fileName}
                  </p>
                </div>
              </div>
            )}

            {hasFile && smoothedTimeline.length > 0 && (
              <>
                <NowNextCards
                  currentChord={currentChord}
                  nextEntry={nextEntry}
                  keyRoot={songKey}
                  playbackTime={playbackTime}
                  simplified={simplified}
                  simplifyFn={display}
                  isMobile={isMobile}
                />
                <RulerTimeline
                  timeline={smoothedTimeline}
                  playbackTime={playbackTime}
                  duration={duration}
                  keyRoot={songKey}
                  filterId={filterId}
                  simplifyFn={display}
                  onSeek={seekTo}
                  isMobile={isMobile}
                />
                <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)', fontFamily:'var(--font-mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: isMobile ? 200 : 400 }}>♫ {fileName}</span>
                  <button onClick={() => { setFileName(null); fileInputRef.current?.click() }}
                    style={{ fontSize:11, color:'rgba(255,255,255,0.35)', background:'none', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'4px 10px', cursor:'pointer', flexShrink:0 }}>
                    change
                  </button>
                  <input ref={fileInputRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
                </div>
              </>
            )}
          </>
        )}

        {/* MIC MODE */}
        {mode === 'mic' && (
          <LiveMicView
            isListening={isListening} startMic={startMic} stopMic={stopMic}
            currentChord={rawCurrentChord} chordHistory={chordHistory}
            volume={volume} error={error}
            simplified={simplified} simplifyFn={display}
            pitchClassAccum={pitchClassAccum}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* ── PLAYER BAR ── */}
      {mode === 'file' && hasFile && duration > 0 && (
        <div style={{
          position:'sticky', bottom:0,
          background:'var(--header-bg)', backdropFilter:'blur(16px)',
          borderTop:'0.5px solid rgba(255,255,255,0.07)',
          padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
          display:'flex', alignItems:'center', gap: isMobile ? '0.625rem' : '1rem',
        }}>
          <button onClick={togglePlayback} style={{
            width:44, height:44, borderRadius:'50%', flexShrink:0, cursor:'pointer',
            background:'var(--accent)', color:'var(--bg)',
            display:'flex', alignItems:'center', justifyContent:'center', border:'none',
          }}>
            {isPlaying
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft:2 }}><polygon points="5,3 19,12 5,21"/></svg>
            }
          </button>

          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.4)', flexShrink:0, minWidth:32 }}>
            {formatTime(playbackTime)}
          </span>

          {/* Seek — also handles touch */}
          <div
            style={{ flex:1, height: isMobile ? 6 : 5, background:'var(--bg4)', borderRadius:3, cursor:'pointer', position:'relative', touchAction:'none' }}
            onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX-r.left)/r.width)*duration) }}
            onTouchEnd={e => { const r=e.currentTarget.getBoundingClientRect(); const t=e.changedTouches[0]; seekTo(Math.max(0,Math.min(1,((t.clientX-r.left)/r.width)))*duration) }}
          >
            <div style={{ position:'absolute', top:0, left:0, height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:3, pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:'50%', left:`${pct}%`, transform:'translate(-50%,-50%)', width: isMobile?16:13, height: isMobile?16:13, background:'var(--accent)', borderRadius:'50%', pointerEvents:'none' }} />
          </div>

          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.4)', flexShrink:0, minWidth:32, textAlign:'right' }}>
            {formatTime(duration)}
          </span>

          {!isMobile && smoothedTimeline.length > 0 && (
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.3)', flexShrink:0, borderLeft:'0.5px solid rgba(255,255,255,0.08)', paddingLeft:12 }}>
              {smoothedTimeline.length} chords
            </span>
          )}
        </div>
      )}

      {showSave && (
        <SaveModal onClose={() => setShowSave(false)} chordHistory={chordHistory} songKey={songKey} bpm={bpm} mode={mode} />
      )}

      <InstallPrompt />

      {showTheme && (
        <ThemeSettings
          themeId={themeId} accentId={accentId} fontSizeId={fontSizeId}
          onTheme={setThemeId} onAccent={setAccentId} onFontSize={setFontSizeId}
          onClose={() => setShowTheme(false)}
        />
      )}
    </div>
  )
}
