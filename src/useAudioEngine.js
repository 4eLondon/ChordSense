import { useRef, useState, useCallback } from 'react'
import { Chord } from 'tonal'

function freqToMidi(freq) {
  return Math.round(12 * Math.log2(freq / 440) + 69)
}

function detectPitches(analyser, sampleRate) {
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Float32Array(bufferLength)
  analyser.getFloatFrequencyData(dataArray)

  const notes = new Set()
  const nyquist = sampleRate / 2
  const freqPerBin = nyquist / bufferLength
  const minBin = Math.floor(27.5 / freqPerBin)
  const maxBin = Math.ceil(4200 / freqPerBin)
  const threshold = -50

  for (let i = Math.max(1, minBin); i < Math.min(maxBin, bufferLength - 1); i++) {
    if (
      dataArray[i] > threshold &&
      dataArray[i] > dataArray[i - 1] &&
      dataArray[i] > dataArray[i + 1]
    ) {
      const freq = i * freqPerBin
      const denom = dataArray[i - 1] - 2 * dataArray[i] + dataArray[i + 1]
      const delta = denom !== 0 ? 0.5 * (dataArray[i - 1] - dataArray[i + 1]) / denom : 0
      const refinedFreq = (i + delta) * freqPerBin
      if (refinedFreq > 27 && refinedFreq < 4200) {
        const midi = freqToMidi(refinedFreq)
        if (midi >= 21 && midi <= 108) notes.add(midi % 12)
      }
    }
  }
  return [...notes]
}

const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function pitchClassesToChord(pitchClasses) {
  if (pitchClasses.length < 2) return null
  const noteNames = pitchClasses.map(pc => PC[pc])
  const chords = Chord.detect(noteNames)
  return chords.length > 0 ? chords[0] : null
}

// ── Chord simplification ──────────────────────────────────────────────────────
const SIMPLIFY_MAP = [
  [/^M$/, 'M'],
  [/^m$/, 'm'],
  [/^(maj|add|sus2|sus4|6|69|M6|M9|M11|M13|maj7|maj9|maj11|maj13|2).*/, 'M'],
  [/^(m7|m9|m11|m13|m6|mM7|min).*/, 'm'],
  [/^(7|9|11|13|dom).*/, 'M'],
  [/^(dim|°|ø|mb5|m7b5).*/, 'm'],
  [/^(aug|\+|#5).*/, 'M'],
  [/^5$/, 'M'],
]

export function simplifyChord(chordName) {
  if (!chordName) return chordName
  const match = chordName.match(/^([A-G][#b]?)(.*)$/)
  if (!match) return chordName
  const [, root, suffix] = match
  const cleanSuffix = suffix.replace(/\/[A-G][#b]?$/, '')
  if (!cleanSuffix || cleanSuffix === 'M') return root
  if (cleanSuffix === 'm') return root + 'm'
  for (const [pattern, replacement] of SIMPLIFY_MAP) {
    if (pattern.test(cleanSuffix)) return replacement === 'M' ? root : root + replacement
  }
  return root
}

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function useAudioEngine() {
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const rafRef = useRef(null)
  const streamRef = useRef(null)

  const playbackCtxRef = useRef(null)
  const playbackSourceRef = useRef(null)
  const playbackAnalyserRef = useRef(null)
  const playbackRafRef = useRef(null)
  const playbackStartTimeRef = useRef(0)
  const playbackOffsetRef = useRef(0)
  const audioBufferRef = useRef(null)

  const lastChordRef = useRef(null)
  const pcAccumRef = useRef(new Float32Array(12))
  const stableCountRef = useRef(0)
  const STABLE_FRAMES = 4

  const [isListening, setIsListening] = useState(false)
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentChord, setCurrentChord] = useState(null)
  const [detectedNotes, setDetectedNotes] = useState([])
  const [chordHistory, setChordHistory] = useState([])
  const [volume, setVolume] = useState(0)
  const [error, setError] = useState(null)
  const [fileProgress, setFileProgress] = useState(0)
  const [songKey, setSongKey] = useState(null)
  const [bpm, setBpm] = useState(null)
  const [fileChordTimeline, setFileChordTimeline] = useState([])
  const [pitchClassAccum, setPitchClassAccum] = useState(new Float32Array(12)) // live accumulator for key detection

  // ── Mic ───────────────────────────────────────────────────────────────────

  const startMic = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0.6
      analyserRef.current = analyser
      const gainNode = ctx.createGain()
      gainNode.gain.value = 1.5
      const source = ctx.createMediaStreamSource(stream)
      source.connect(gainNode)
      gainNode.connect(analyser)
      sourceRef.current = source
      setIsListening(true)

      const tick = () => {
        const td = new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(td)
        let rms = 0
        for (let i = 0; i < td.length; i++) rms += td[i] * td[i]
        setVolume(Math.min(1, Math.sqrt(rms / td.length) * 8))

        // Accumulate pitch-class energy for K-S key detection
        const freqData = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatFrequencyData(freqData)
        const nyquist = ctx.sampleRate / 2
        const fpb = nyquist / analyser.frequencyBinCount
        for (let bi = Math.floor(27.5 / fpb); bi < Math.min(Math.ceil(4200 / fpb), freqData.length); bi++) {
          const mag = Math.max(0, freqData[bi] + 80) // shift from dB
          const freq = bi * fpb
          const midi = Math.round(12 * Math.log2(freq / 440) + 69)
          if (midi >= 21 && midi <= 108) {
            pcAccumRef.current[midi % 12] += mag
          }
        }
        // Expose to React every ~30 frames
        if (Math.random() < 0.033) setPitchClassAccum(new Float32Array(pcAccumRef.current))

        const pitches = detectPitches(analyser, ctx.sampleRate)
        if (pitches.length >= 2) {
          setDetectedNotes(pitches.map(pc => PC[pc]))
          const chord = pitchClassesToChord(pitches)
          if (chord) {
            if (chord === lastChordRef.current) stableCountRef.current++
            else { stableCountRef.current = 0; lastChordRef.current = chord }
            if (stableCountRef.current === STABLE_FRAMES) {
              setCurrentChord(chord)
              setChordHistory(prev => [{ chord, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30))
            }
          }
        } else {
          setDetectedNotes([])
          stableCountRef.current = 0
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setError(err.message || 'Microphone access denied')
    }
  }, [])

  const stopMic = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close()
    audioCtxRef.current = null; analyserRef.current = null
    sourceRef.current = null; streamRef.current = null
    setIsListening(false); setVolume(0); setDetectedNotes([])
    pcAccumRef.current = new Float32Array(12)
    setPitchClassAccum(new Float32Array(12))
  }, [])

  // ── File analysis ─────────────────────────────────────────────────────────

  const analyzeFile = useCallback(async (file) => {
    try {
      setError(null)
      setIsAnalyzingFile(true)
      setFileProgress(0)
      setFileChordTimeline([])
      setSongKey(null)
      setBpm(null)
      setCurrentChord(null)
      setChordHistory([])
      setPlaybackTime(0)

      if (playbackSourceRef.current) { try { playbackSourceRef.current.stop() } catch {} playbackSourceRef.current = null }
      if (playbackRafRef.current) cancelAnimationFrame(playbackRafRef.current)
      if (playbackCtxRef.current) { try { playbackCtxRef.current.close() } catch {} playbackCtxRef.current = null }
      playbackOffsetRef.current = 0
      setIsPlaying(false)

      const arrayBuffer = await file.arrayBuffer()
      const ctx = new (window.AudioContext || window.webkitAudioContext)()

      setFileProgress(20)
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      audioBufferRef.current = audioBuffer
      setDuration(audioBuffer.duration)
      setFileProgress(40)

      const sampleRate = audioBuffer.sampleRate
      const channelData = audioBuffer.getChannelData(0)
      const frameSize = 8192
      const hopSize = 4096
      const timeline = []
      const allPitchClasses = new Array(12).fill(0)
      const totalFrames = Math.floor((channelData.length - frameSize) / hopSize)

      for (let frame = 0; frame < totalFrames; frame++) {
        const offset = frame * hopSize
        const slice = channelData.slice(offset, offset + frameSize)
        const offCtx = new OfflineAudioContext(1, frameSize, sampleRate)
        const buf = offCtx.createBuffer(1, frameSize, sampleRate)
        buf.copyToChannel(slice, 0)
        const src = offCtx.createBufferSource()
        src.buffer = buf
        const analyser = offCtx.createAnalyser()
        analyser.fftSize = frameSize
        analyser.smoothingTimeConstant = 0
        src.connect(analyser)
        analyser.connect(offCtx.destination)
        src.start()
        await offCtx.startRendering()

        const pitches = detectPitches(analyser, sampleRate)
        if (pitches.length >= 2) {
          const chord = pitchClassesToChord(pitches)
          const timestamp = offset / sampleRate
          pitches.forEach(pc => allPitchClasses[pc]++)
          if (chord) {
            const last = timeline[timeline.length - 1]
            if (!last || last.chord !== chord) {
              timeline.push({ chord, time: timestamp, notes: pitches.map(pc => PC[pc]), timeLabel: formatTime(timestamp) })
            }
          }
        }
        if (frame % 20 === 0) setFileProgress(40 + Math.round((frame / totalFrames) * 50))
      }

      const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
      setSongKey(keyNames[allPitchClasses.indexOf(Math.max(...allPitchClasses))])

      const onsets = []
      const ws = Math.floor(sampleRate * 0.02)
      for (let i = ws; i < channelData.length - ws; i += ws) {
        const prev = channelData.slice(i - ws, i).reduce((s, v) => s + v * v, 0)
        const curr = channelData.slice(i, i + ws).reduce((s, v) => s + v * v, 0)
        if (curr > prev * 1.5) onsets.push(i / sampleRate)
      }
      if (onsets.length > 2) {
        const intervals = []
        for (let i = 1; i < Math.min(onsets.length, 20); i++) intervals.push(onsets[i] - onsets[i - 1])
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
        if (avg > 0) setBpm(Math.round(60 / avg))
      }

      setFileProgress(100)
      setFileChordTimeline(timeline)
      setChordHistory(timeline.slice().reverse().map(e => ({ chord: e.chord, time: e.timeLabel })))
      if (timeline.length > 0) setCurrentChord(timeline[0].chord)
      await ctx.close()
      setIsAnalyzingFile(false)
    } catch (err) {
      setError(err.message || 'Failed to analyze file')
      setIsAnalyzingFile(false)
    }
  }, [])

  // ── Playback ──────────────────────────────────────────────────────────────

  const startPlayback = useCallback((fromOffset = 0) => {
    if (!audioBufferRef.current) return

    if (playbackSourceRef.current) { try { playbackSourceRef.current.stop() } catch {} }
    if (playbackRafRef.current) cancelAnimationFrame(playbackRafRef.current)
    if (playbackCtxRef.current) { try { playbackCtxRef.current.close() } catch {} }

    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    playbackCtxRef.current = ctx

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 8192
    analyser.smoothingTimeConstant = 0.5
    playbackAnalyserRef.current = analyser

    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(analyser)
    analyser.connect(ctx.destination)
    source.start(0, fromOffset)
    playbackSourceRef.current = source
    playbackStartTimeRef.current = ctx.currentTime
    playbackOffsetRef.current = fromOffset

    source.onended = () => {
      if (playbackRafRef.current) cancelAnimationFrame(playbackRafRef.current)
      setIsPlaying(false)
      setPlaybackTime(audioBufferRef.current?.duration || 0)
      playbackOffsetRef.current = 0
    }

    setIsPlaying(true)

    const tick = () => {
      const elapsed = ctx.currentTime - playbackStartTimeRef.current
      setPlaybackTime(fromOffset + elapsed)

      const td = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(td)
      let rms = 0
      for (let i = 0; i < td.length; i++) rms += td[i] * td[i]
      setVolume(Math.min(1, Math.sqrt(rms / td.length) * 6))

      const pitches = detectPitches(analyser, ctx.sampleRate)
      if (pitches.length >= 2) {
        setDetectedNotes(pitches.map(pc => PC[pc]))
        const chord = pitchClassesToChord(pitches)
        if (chord) {
          if (chord === lastChordRef.current) stableCountRef.current++
          else { stableCountRef.current = 0; lastChordRef.current = chord }
          if (stableCountRef.current === STABLE_FRAMES) setCurrentChord(chord)
        }
      } else {
        setDetectedNotes([])
      }
      playbackRafRef.current = requestAnimationFrame(tick)
    }
    playbackRafRef.current = requestAnimationFrame(tick)
  }, [])

  const pausePlayback = useCallback(() => {
    if (playbackRafRef.current) cancelAnimationFrame(playbackRafRef.current)
    if (playbackSourceRef.current) { try { playbackSourceRef.current.stop() } catch {} playbackSourceRef.current = null }
    if (playbackCtxRef.current) {
      const elapsed = playbackCtxRef.current.currentTime - playbackStartTimeRef.current
      playbackOffsetRef.current = playbackOffsetRef.current + elapsed
      try { playbackCtxRef.current.close() } catch {}
      playbackCtxRef.current = null
    }
    setIsPlaying(false)
    setVolume(0)
  }, [])

  const seekTo = useCallback((seconds) => {
    playbackOffsetRef.current = seconds
    setPlaybackTime(seconds)
    if (isPlaying) startPlayback(seconds)
  }, [isPlaying, startPlayback])

  const togglePlayback = useCallback(() => {
    if (isPlaying) pausePlayback()
    else startPlayback(playbackOffsetRef.current)
  }, [isPlaying, pausePlayback, startPlayback])

  return {
    isListening, startMic, stopMic,
    pitchClassAccum,
    isAnalyzingFile, fileProgress, analyzeFile,
    fileChordTimeline, songKey, bpm,
    isPlaying, playbackTime, duration, togglePlayback, seekTo,
    currentChord, detectedNotes, chordHistory,
    volume, error,
  }
}
