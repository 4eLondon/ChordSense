/**
 * useVocalPitch.js — tuned for laptop/phone built-in mics
 *
 * Audio chain:
 *   mic → highpass (cuts fan/rumble) → compressor (tames AGC jumps)
 *       → gain boost → analyser → YIN
 *
 * Key tuning decisions for laptop/phone:
 *   - autoGainControl OFF  : AGC causes level jumps that break YIN autocorrelation
 *   - echoCancellation ON  : laptop speakers can feed back
 *   - noiseSuppression ON  : removes steady-state noise (fan hum)
 *   - highpass at 100Hz    : kills remaining low-frequency rumble
 *   - DynamicsCompressor   : normalises volume so quiet singers still register
 *   - +18dB gain           : laptop mics are 15-20dB quieter than dedicated mics
 *   - YIN threshold 0.15   : slightly more lenient (was 0.12) — laptop mics have
 *                            higher noise floor, too-strict threshold misses notes
 *   - Confidence gate 0.68 : was 0.78 — relaxed for noisier signal
 *   - Stable frames 2      : was 3 — faster response
 *   - Adaptive VAD         : uses rolling noise floor estimate instead of fixed
 *                            threshold, so it works regardless of mic sensitivity
 */

import { useRef, useState, useCallback } from 'react'

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

// ── Frequency → note info ──────────────────────────────────────────────────────
function freqToNote(freq) {
  if (!freq || freq < 65 || freq > 1200) return null
  const midi   = 12 * Math.log2(freq / 440) + 69
  const midiR  = Math.round(midi)
  const pc     = ((midiR % 12) + 12) % 12
  const octave = Math.floor(midiR / 12) - 1
  const cents  = Math.round((midi - midiR) * 100)
  return { name: NOTE_NAMES[pc] + octave, note: NOTE_NAMES[pc], pc, octave, cents, midi }
}

// ── YIN pitch detection ────────────────────────────────────────────────────────
function yin(buffer, sampleRate, threshold = 0.15) {
  // Vocal frequency bounds: 65Hz (C2, low bass) to 1100Hz (C6, high soprano)
  const minPeriod = Math.floor(sampleRate / 1100)
  const maxPeriod = Math.floor(sampleRate / 65)
  const halfLen   = Math.floor(buffer.length / 2)

  // Step 1: Difference function
  const diff = new Float32Array(maxPeriod + 1)
  for (let tau = 1; tau <= maxPeriod; tau++) {
    for (let i = 0; i < halfLen; i++) {
      const d = buffer[i] - buffer[i + tau]
      diff[tau] += d * d
    }
  }

  // Step 2: Cumulative mean normalised difference (CMND)
  const cmnd = new Float32Array(maxPeriod + 1)
  cmnd[0] = 1
  let runningSum = 0
  for (let tau = 1; tau <= maxPeriod; tau++) {
    runningSum += diff[tau]
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1
  }

  // Step 3: First dip below threshold (left-to-right = lowest period = highest freq first)
  for (let tau = minPeriod; tau < maxPeriod - 1; tau++) {
    if (cmnd[tau] < threshold) {
      // Step 4: Parabolic interpolation
      const x0  = cmnd[tau - 1] ?? cmnd[tau]
      const x1  = cmnd[tau]
      const x2  = cmnd[tau + 1]
      const den = x0 - 2 * x1 + x2
      const off = den !== 0 ? 0.5 * (x0 - x2) / den : 0
      const t   = tau + off
      return { freq: sampleRate / t, confidence: 1 - x1, tau: t }
    }
  }

  // No dip found: return global minimum (lowest CMND = most periodic)
  let minVal = Infinity, minTau = minPeriod
  for (let tau = minPeriod; tau < maxPeriod; tau++) {
    if (cmnd[tau] < minVal) { minVal = cmnd[tau]; minTau = tau }
  }
  return { freq: sampleRate / minTau, confidence: 1 - minVal, tau: minTau }
}

// ── Adaptive VAD ────────────────────────────────────────────────────────────────
// Tracks rolling noise floor so VAD works on any mic sensitivity
class AdaptiveVAD {
  constructor() {
    this.noiseFloor  = 0.003   // initial estimate — updated over time
    this.frameCount  = 0
  }
  isActive(rms) {
    this.frameCount++
    // Every 60 frames (~1s) update noise floor using minimum observed RMS
    if (this.frameCount % 60 === 0) {
      this.noiseFloor = Math.max(0.001, Math.min(this.noiseFloor, rms * 0.8))
    }
    // Signal is "voice" if it's 3× the noise floor (6dB headroom)
    return rms > this.noiseFloor * 3.0
  }
}

// ── Octave error guard ──────────────────────────────────────────────────────────
// YIN sometimes reports pitch an octave too high or low.
// If the new freq is exactly 2× or 0.5× the smoothed freq, it's likely an octave error.
function fixOctaveError(freq, smoothed) {
  if (!smoothed || !freq) return freq
  const ratio = freq / smoothed
  if (ratio > 1.85 && ratio < 2.15) return freq / 2   // octave too high
  if (ratio > 0.45 && ratio < 0.55) return freq * 2   // octave too low
  return freq
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useVocalPitch() {
  const ctxRef        = useRef(null)
  const analyserRef   = useRef(null)
  const gainNodeRef   = useRef(null)
  const streamRef     = useRef(null)
  const rafRef        = useRef(null)
  const pcAccumRef    = useRef(new Float32Array(12))
  const smoothFreqRef = useRef(null)
  const lastNoteRef   = useRef(null)
  const stableRef     = useRef(0)
  const vadRef        = useRef(new AdaptiveVAD())
  const frameRmsRef   = useRef([])         // rolling RMS for SNR estimate
  const sensitivityRef= useRef(1.0)        // 0.5 – 2.0 multiplier

  // React state
  const [isListening,       setIsListening]       = useState(false)
  const [currentNote,       setCurrentNote]       = useState(null)
  const [currentPitchClass, setCurrentPitchClass] = useState(null)
  const [currentFreq,       setCurrentFreq]       = useState(null)
  const [currentCents,      setCurrentCents]      = useState(0)
  const [pitchConfidence,   setPitchConfidence]   = useState(0)
  const [pitchAccum,        setPitchAccum]        = useState(new Float32Array(12))
  const [volume,            setVolume]            = useState(0)
  const [signalQuality,     setSignalQuality]     = useState(0)  // 0-1 SNR estimate
  const [error,             setError]             = useState(null)
  const [noteHistory,       setNoteHistory]       = useState([])
  const [sensitivity,       setSensitivity]       = useState(1.0)

  // Expose sensitivity setter that also updates the gain node live
  const setSens = useCallback((val) => {
    sensitivityRef.current = val
    setSensitivity(val)
    if (gainNodeRef.current) {
      // Map 0.5-2.0 → 6-32 dB gain
      gainNodeRef.current.gain.setTargetAtTime(val * 12, ctxRef.current.currentTime, 0.05)
    }
  }, [])

  const start = useCallback(async () => {
    try {
      setError(null)
      vadRef.current = new AdaptiveVAD()
      frameRmsRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:  true,   // catches laptop speaker bleed
          noiseSuppression:  true,   // removes steady fan hum
          autoGainControl:   false,  // MUST be OFF — AGC jumps wreck YIN autocorrelation
          // Don't force sampleRate — let browser use native rate (avoids resampler artifacts)
        },
        video: false,
      })
      streamRef.current = stream

      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx

      // ── Audio processing chain ────────────────────────────────────────────
      const source = ctx.createMediaStreamSource(stream)

      // 1. High-pass filter: cuts everything below 100Hz (fan noise, handling noise, plosives)
      const hpf = ctx.createBiquadFilter()
      hpf.type            = 'highpass'
      hpf.frequency.value = 100
      hpf.Q.value         = 0.7   // gentle slope

      // 2. Dynamics compressor: brings quiet voices up, prevents clipping
      //    — fast attack so it catches the note onset quickly
      //    — high ratio so dynamic range is tightly controlled
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -30   // dB — start compressing at -30dBFS
      compressor.knee.value      = 6     // soft knee
      compressor.ratio.value     = 8     // 8:1 compression
      compressor.attack.value    = 0.003 // 3ms — fast enough to catch note attack
      compressor.release.value   = 0.15  // 150ms — smooth release

      // 3. Gain boost: laptop mics are ~15-20dB quieter than dedicated mics
      const gainNode = ctx.createGain()
      gainNode.gain.value = sensitivityRef.current * 12  // ~12 = +22dB baseline
      gainNodeRef.current = gainNode

      // 4. Analyser: large FFT for time-domain data
      const analyser = ctx.createAnalyser()
      analyser.fftSize             = 4096
      analyser.smoothingTimeConstant = 0.0  // no smoothing — we do our own EMA
      analyserRef.current = analyser

      // Connect chain
      source.connect(hpf)
      hpf.connect(compressor)
      compressor.connect(gainNode)
      gainNode.connect(analyser)
      // Note: analyser NOT connected to destination — silent processing

      setIsListening(true)

      const BUF = new Float32Array(4096)

      // Tuning constants for laptop/phone mics
      const YIN_THRESHOLD   = 0.15   // slightly relaxed vs studio (was 0.12)
      const CONF_GATE       = 0.65   // relaxed from 0.78 — laptop mics have noisier signal
      const STABLE_FRAMES   = 2      // reduced from 3 — faster response
      const EMA_ALPHA       = 0.35   // frequency smoothing factor

      const tick = () => {
        analyser.getFloatTimeDomainData(BUF)

        // ── RMS + adaptive VAD ──────────────────────────────────────────────
        let rms = 0
        for (let i = 0; i < BUF.length; i++) rms += BUF[i] * BUF[i]
        rms = Math.sqrt(rms / BUF.length)

        // Rolling RMS history for SNR display (last 30 frames)
        frameRmsRef.current.push(rms)
        if (frameRmsRef.current.length > 30) frameRmsRef.current.shift()
        const maxRms = Math.max(...frameRmsRef.current)
        const minRms = Math.min(...frameRmsRef.current)
        const snr    = maxRms > 0 ? Math.min(1, (maxRms - minRms) / maxRms) : 0
        setSignalQuality(snr)

        setVolume(Math.min(1, rms * 5))

        const voiceActive = vadRef.current.isActive(rms)
        if (!voiceActive) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }

        // ── YIN ────────────────────────────────────────────────────────────
        const result = yin(BUF, ctx.sampleRate, YIN_THRESHOLD)

        setPitchConfidence(result.confidence)

        if (result.confidence >= CONF_GATE) {
          // Fix octave errors
          const correctedFreq = fixOctaveError(result.freq, smoothFreqRef.current)

          // EMA frequency smoothing — damps vibrato, keeps pitch center accurate
          smoothFreqRef.current = smoothFreqRef.current
            ? EMA_ALPHA * correctedFreq + (1 - EMA_ALPHA) * smoothFreqRef.current
            : correctedFreq

          const noteInfo = freqToNote(smoothFreqRef.current)
          if (!noteInfo) { rafRef.current = requestAnimationFrame(tick); return }

          // Stability gate
          if (noteInfo.note === lastNoteRef.current) {
            stableRef.current++
          } else {
            stableRef.current = 0
            lastNoteRef.current = noteInfo.note
          }

          if (stableRef.current >= STABLE_FRAMES) {
            setCurrentNote(noteInfo.name)
            setCurrentPitchClass(noteInfo.pc)
            setCurrentFreq(Math.round(smoothFreqRef.current))
            setCurrentCents(noteInfo.cents)

            // Accumulate pitch class — weight by confidence × rms for quality
            // Higher confidence & louder = more weight (sustained notes matter more)
            const weight = result.confidence * Math.min(1, rms * 30)
            pcAccumRef.current[noteInfo.pc] += weight * 3

            // Gentle decay — recent notes matter more but old ones don't vanish instantly
            for (let i = 0; i < 12; i++) pcAccumRef.current[i] *= 0.9975

            setNoteHistory(prev => {
              if (prev[0]?.pc === noteInfo.pc) return prev
              return [{
                pc: noteInfo.pc, note: noteInfo.note,
                name: noteInfo.name, time: Date.now(),
              }, ...prev].slice(0, 80)
            })

            // Push accumulator to React every ~15 frames (~250ms)
            if (Math.random() < 0.07) setPitchAccum(new Float32Array(pcAccumRef.current))
          }
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Make sure your device has a working microphone.')
      } else {
        setError(err.message || 'Could not start microphone')
      }
    }
  }, [])

  const stop = useCallback(() => {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (ctxRef.current)    ctxRef.current.close()
    ctxRef.current = null; analyserRef.current = null
    gainNodeRef.current = null; streamRef.current = null
    smoothFreqRef.current = null
    setIsListening(false); setVolume(0)
    setCurrentNote(null); setCurrentPitchClass(null)
    setCurrentFreq(null); setPitchConfidence(0)
    setSignalQuality(0)
  }, [])

  const reset = useCallback(() => {
    pcAccumRef.current = new Float32Array(12)
    vadRef.current     = new AdaptiveVAD()
    frameRmsRef.current = []
    setPitchAccum(new Float32Array(12))
    setNoteHistory([])
    setCurrentNote(null); setCurrentPitchClass(null)
    setCurrentFreq(null); setCurrentCents(0)
    lastNoteRef.current = null; stableRef.current = 0
    smoothFreqRef.current = null; setSignalQuality(0)
  }, [])

  return {
    isListening, start, stop, reset,
    currentNote, currentPitchClass, currentFreq, currentCents,
    pitchConfidence, pitchAccum,
    volume, signalQuality, error, noteHistory,
    sensitivity, setSensitivity: setSens,
  }
}
