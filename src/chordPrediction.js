/**
 * chordPrediction.js
 *
 * Predicts likely next chords using:
 * 1. Observed history from the current session (what's actually been played)
 * 2. Key-based harmonic probability tables (music theory)
 * 3. Circle-of-fifths weighting as a fallback
 *
 * Returns an array of { chord, probability, source } sorted by probability desc.
 */

import { getRomanNumeral, normalizeNote, pitchClass } from './musicTheory'
import { Chord } from 'tonal'

// ── Harmonic transition tables ────────────────────────────────────────────────
// For each scale degree (1-7), probability weights for what follows.
// Based on common-practice harmony + pop/gospel/jazz idioms.
// Rows = current degree, columns = next degree (1..7)
//                          1     2     3     4     5     6     7
const MAJOR_TRANSITIONS = [
  /* from I   */ [0.08, 0.15, 0.05, 0.25, 0.28, 0.14, 0.05],
  /* from ii  */ [0.08, 0.04, 0.03, 0.10, 0.50, 0.12, 0.13],
  /* from iii */ [0.08, 0.05, 0.04, 0.22, 0.20, 0.35, 0.06],
  /* from IV  */ [0.30, 0.10, 0.05, 0.08, 0.30, 0.12, 0.05],
  /* from V   */ [0.55, 0.08, 0.05, 0.10, 0.06, 0.12, 0.04],
  /* from vi  */ [0.12, 0.18, 0.05, 0.28, 0.24, 0.08, 0.05],
  /* from vii°*/ [0.65, 0.05, 0.10, 0.08, 0.05, 0.05, 0.02],
]

const MINOR_TRANSITIONS = [
  /* from i   */ [0.06, 0.12, 0.08, 0.26, 0.25, 0.16, 0.07],
  /* from ii° */ [0.06, 0.04, 0.04, 0.10, 0.55, 0.10, 0.11],
  /* from III */ [0.10, 0.06, 0.04, 0.20, 0.18, 0.32, 0.10],
  /* from iv  */ [0.28, 0.10, 0.05, 0.08, 0.34, 0.10, 0.05],
  /* from v/V */ [0.52, 0.08, 0.05, 0.12, 0.06, 0.12, 0.05],
  /* from VI  */ [0.12, 0.16, 0.08, 0.28, 0.22, 0.08, 0.06],
  /* from VII */ [0.20, 0.08, 0.08, 0.18, 0.24, 0.14, 0.08],
]

// ── Scale degree → chord quality in major/minor keys ─────────────────────────
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE_SEMITONES = [0, 2, 3, 5, 7, 8, 10]
const MAJOR_QUALITIES = ['M', 'm', 'm', 'M', 'M', 'm', 'dim']
const MINOR_QUALITIES = ['m', 'dim', 'M', 'm', 'm', 'M', 'M']

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function buildScaleChords(keyRoot, keyMode = 'major') {
  const rootPc = pitchClass(normalizeNote(keyRoot))
  if (rootPc === -1) return []
  const semitones = keyMode === 'minor' ? MINOR_SCALE_SEMITONES : MAJOR_SCALE_SEMITONES
  const qualities = keyMode === 'minor' ? MINOR_QUALITIES : MAJOR_QUALITIES
  return semitones.map((s, i) => {
    const notePc = (rootPc + s) % 12
    const note = NOTE_NAMES[notePc]
    const q = qualities[i]
    return q === 'M' ? note : q === 'm' ? note + 'm' : note + 'dim'
  })
}

// ── Session-based Markov counter ─────────────────────────────────────────────
// Tracks what the user has actually played: { "C→G": 3, "G→Am": 2, ... }
class SessionMarkov {
  constructor() { this.counts = {} }

  record(fromChord, toChord) {
    if (!fromChord || !toChord || fromChord === toChord) return
    const key = `${simplifyRoot(fromChord)}→${simplifyRoot(toChord)}`
    this.counts[key] = (this.counts[key] || 0) + 1
  }

  // Returns { chord → count } for all observed transitions from `fromChord`
  getTransitions(fromChord) {
    const prefix = `${simplifyRoot(fromChord)}→`
    const result = {}
    for (const [key, count] of Object.entries(this.counts)) {
      if (key.startsWith(prefix)) {
        const to = key.slice(prefix.length)
        result[to] = count
      }
    }
    return result
  }

  get totalObservations() {
    return Object.values(this.counts).reduce((a, b) => a + b, 0)
  }
}

// Strip octave and extensions for Markov keys: "Cmaj7/E" → "C"
function simplifyRoot(chord) {
  if (!chord) return ''
  return chord.match(/^([A-G][#b]?)/)?.[1] || chord
}

// ── Main prediction function ──────────────────────────────────────────────────
export function predictNextChords(
  currentChord,
  chordHistory,        // array of { chord } most recent first
  keyRoot,
  keyMode = 'major',
  sessionMarkov,       // SessionMarkov instance
  topN = 3,
) {
  if (!currentChord) return []

  const candidates = new Map() // chord → score

  const addScore = (chord, score, reason) => {
    if (!chord || chord === currentChord) return
    const existing = candidates.get(chord) || { score: 0, reasons: [] }
    existing.score += score
    existing.reasons.push(reason)
    candidates.set(chord, existing)
  }

  // ── 1. Session history (strongest signal if we have enough data) ──────────
  if (sessionMarkov && sessionMarkov.totalObservations >= 3) {
    const observed = sessionMarkov.getTransitions(currentChord)
    const totalObs = Object.values(observed).reduce((a, b) => a + b, 0)
    if (totalObs > 0) {
      for (const [chord, count] of Object.entries(observed)) {
        addScore(chord, (count / totalObs) * 0.7, 'session')
      }
    }
  }

  // ── 2. Key-based harmonic probability ─────────────────────────────────────
  if (keyRoot) {
    const scaleChords = buildScaleChords(keyRoot, keyMode)
    const transitions = keyMode === 'minor' ? MINOR_TRANSITIONS : MAJOR_TRANSITIONS

    // Find current chord's degree in the key
    const roman = getRomanNumeral(currentChord, keyRoot, keyMode)
    if (roman) {
      const fromDegree = roman.degree - 1 // 0-indexed
      const probs = transitions[fromDegree]
      probs.forEach((prob, toDegree) => {
        const targetChord = scaleChords[toDegree]
        if (targetChord && prob > 0.04) {
          addScore(targetChord, prob * 0.5, 'harmony')
        }
      })
    }

    // ── 3. Pattern in recent history (last 3 chords) ─────────────────────────
    // If we've seen A→B→C before, and we're on B, suggest C
    const recent = chordHistory.slice(0, 6).map(h => simplifyRoot(h.chord))
    const currentRoot = simplifyRoot(currentChord)
    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i] === currentRoot && recent[i + 1]) {
        // Find the full chord name from scale chords
        const nextRoot = recent[i + 1]
        const matchingScaleChord = scaleChords.find(c => simplifyRoot(c) === nextRoot)
        const target = matchingScaleChord || nextRoot
        addScore(target, 0.25, 'pattern')
      }
    }
  }

  // ── 4. Circle of fifths fallback ──────────────────────────────────────────
  const rootPc = pitchClass(normalizeNote(simplifyRoot(currentChord)))
  if (rootPc !== -1) {
    // Dominant (up a perfect 4th = down a 5th)
    const dominant = NOTE_NAMES[(rootPc + 5) % 12]
    addScore(dominant, 0.15, 'circle')
    // Subdominant (up a perfect 5th)
    const subdom = NOTE_NAMES[(rootPc + 7) % 12]
    addScore(subdom, 0.10, 'circle')
    // Relative minor/major
    const isMinorish = /^[A-G][#b]?m/.test(currentChord)
    if (isMinorish) {
      addScore(NOTE_NAMES[(rootPc + 3) % 12], 0.10, 'relative')
    } else {
      addScore(NOTE_NAMES[(rootPc + 9) % 12] + 'm', 0.10, 'relative')
    }
  }

  // ── Sort and return top N ─────────────────────────────────────────────────
  const sorted = [...candidates.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topN)
    .map(([chord, { score, reasons }]) => ({
      chord,
      probability: Math.min(0.99, score),
      source: reasons.includes('session') ? 'session'
            : reasons.includes('pattern') ? 'pattern'
            : reasons.includes('harmony') ? 'harmony'
            : 'circle',
    }))

  return sorted
}

export { SessionMarkov }
