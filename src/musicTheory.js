import { Chord, Key, Note } from 'tonal'

// Re-export simplifyChord here so components can import from one place
const SIMPLIFY_MAP = [
  [/^M$/, 'M'], [/^m$/, 'm'],
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
  const clean = suffix.replace(/\/[A-G][#b]?$/, '')
  if (!clean || clean === 'M') return root
  if (clean === 'm') return root + 'm'
  for (const [pat, rep] of SIMPLIFY_MAP) {
    if (pat.test(clean)) return rep === 'M' ? root : root + rep
  }
  return root
}

// All 12 pitch classes
const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Enharmonic normalization
const ENHARMONIC = {
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
  'Cb': 'B',  'Fb': 'E',  'E#': 'F',  'B#': 'C',
}

export function normalizeNote(note) {
  return ENHARMONIC[note] || note
}

// Get pitch class index (0–11)
export function pitchClass(noteName) {
  const n = normalizeNote(noteName)
  return PC_NAMES.indexOf(n)
}

// Get the root note from a chord name like "Cm7" → "C", "F#maj7" → "F#"
export function chordRoot(chordName) {
  if (!chordName) return null
  const m = chordName.match(/^([A-G][#b]?)/)
  return m ? m[1] : null
}

// Is the chord minor-quality?
export function isMinorChord(chordName) {
  if (!chordName) return false
  const m = chordName.match(/^[A-G][#b]?(.*)$/)
  const suffix = m ? m[1].replace(/\/[A-G][#b]?$/, '') : ''
  return /^m(?!aj|a)/i.test(suffix) || /^(dim|°|ø|mb5|m7b5)/.test(suffix)
}

// Is the chord major-quality?
export function isMajorChord(chordName) {
  if (!chordName) return false
  return !isMinorChord(chordName)
}

// ── Roman numeral analysis ────────────────────────────────────────────────────
// Given a key root (e.g. "C") returns the scale degrees for major/minor
// Returns { degree: 1-7, label: 'I'|'ii'|'iii'... } or null

const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11] // semitones from root
const MINOR_DEGREES = [0, 2, 3, 5, 7, 8, 10]
const MAJOR_ROMAN   = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const MINOR_ROMAN   = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']

export function getRomanNumeral(chordName, keyRoot, keyMode = 'major') {
  if (!chordName || !keyRoot) return null
  const root = chordRoot(chordName)
  if (!root) return null
  const keyPc = pitchClass(normalizeNote(keyRoot))
  const chordPc = pitchClass(normalizeNote(root))
  if (keyPc === -1 || chordPc === -1) return null
  const interval = ((chordPc - keyPc) + 12) % 12
  const degrees = keyMode === 'minor' ? MINOR_DEGREES : MAJOR_DEGREES
  const romans  = keyMode === 'minor' ? MINOR_ROMAN  : MAJOR_ROMAN
  const idx = degrees.indexOf(interval)
  return idx >= 0 ? { degree: idx + 1, label: romans[idx] } : null
}

// ── Filter modes ──────────────────────────────────────────────────────────────

export const FILTER_MODES = [
  { id: 'all',   label: 'All chords',  degrees: null,        description: 'Show every detected chord' },
  { id: '145',   label: '1 - 4 - 5',  degrees: [1, 4, 5],   description: 'Primary chords (I IV V) : gospel, blues, folk' },
  { id: '125',   label: '1 - 2 - 5',  degrees: [1, 2, 5],   description: 'Jazz/R&B movement (I ii V)' },
  { id: '1645',  label: '1-6-4-5',    degrees: [1, 6, 4, 5], description: 'Classic pop progression (I vi IV V)' },
  { id: '1564',  label: '1-5-6-4',    degrees: [1, 5, 6, 4], description: 'Modern pop (I V vi IV)' },
  { id: 'major', label: 'Major only', degrees: null,         description: 'Only major-quality chords', quality: 'major' },
  { id: 'minor', label: 'Minor only', degrees: null,         description: 'Only minor-quality chords', quality: 'minor' },
]

// Returns true if a chord should be shown given the current filter + key
export function chordMatchesFilter(chordName, filterId, keyRoot, keyMode = 'major') {
  if (filterId === 'all') return true
  const mode = FILTER_MODES.find(m => m.id === filterId)
  if (!mode) return true

  if (mode.quality === 'major') return isMajorChord(chordName)
  if (mode.quality === 'minor') return isMinorChord(chordName)

  if (mode.degrees && keyRoot) {
    const roman = getRomanNumeral(chordName, keyRoot, keyMode)
    return roman ? mode.degrees.includes(roman.degree) : false
  }
  return true
}

// ── Next chord prediction ─────────────────────────────────────────────────────
// Given a pre-analyzed timeline and current playback time, find the next chord
export function getNextChord(timeline, currentTime, filterId, keyRoot) {
  if (!timeline || timeline.length === 0) return null

  // Find all future chords
  const future = timeline.filter(e => e.time > currentTime + 0.1)
  if (future.length === 0) return null

  if (filterId === 'all') return future[0]

  // Return the next chord that matches the filter
  return future.find(e => chordMatchesFilter(e.chord, filterId, keyRoot)) || future[0]
}

// Get current chord from timeline (for file mode)
export function getCurrentChordFromTimeline(timeline, currentTime) {
  if (!timeline || timeline.length === 0) return null
  let current = null
  for (const entry of timeline) {
    if (entry.time <= currentTime) current = entry
    else break
  }
  return current
}
