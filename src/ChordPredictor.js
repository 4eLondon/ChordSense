import { pitchClass, normalizeNote, getRomanNumeral, chordRoot } from './musicTheory'

// ── Transition probabilities by scale degree ──────────────────────────────────
// Based on common-practice western harmony + pop/gospel/R&B conventions
// Format: { fromDegree: { toDegree: weight } }
// Weights are relative — higher = more likely

const MAJOR_TRANSITIONS = {
  1: { 4: 30, 5: 28, 6: 20, 2: 12, 3: 6,  7: 4  },  // I  → IV, V most common
  2: { 5: 40, 1: 20, 4: 18, 6: 12, 7: 6,  3: 4  },  // ii → V  strong pull
  3: { 6: 30, 4: 25, 1: 20, 2: 15, 5: 8,  7: 2  },  // iii → vi, IV
  4: { 5: 32, 1: 28, 2: 18, 6: 12, 3: 6,  7: 4  },  // IV → V, I
  5: { 1: 45, 6: 20, 4: 15, 2: 10, 3: 6,  7: 4  },  // V  → I  strongest pull
  6: { 4: 28, 2: 22, 5: 20, 1: 16, 3: 8,  7: 6  },  // vi → IV, ii
  7: { 1: 50, 3: 20, 5: 18, 6: 8,  2: 4,  4: 0  },  // vii° → I
}

const MINOR_TRANSITIONS = {
  1: { 4: 28, 5: 25, 6: 20, 2: 12, 3: 8,  7: 7  },
  2: { 5: 42, 1: 18, 4: 16, 6: 14, 3: 6,  7: 4  },
  3: { 6: 28, 4: 24, 1: 22, 2: 14, 5: 8,  7: 4  },
  4: { 5: 30, 1: 26, 2: 20, 6: 14, 3: 6,  7: 4  },
  5: { 1: 42, 6: 22, 4: 16, 2: 10, 3: 6,  7: 4  },
  6: { 3: 30, 7: 22, 2: 18, 4: 16, 1: 10, 5: 4  },
  7: { 1: 48, 3: 22, 5: 16, 6: 6,  2: 4,  4: 4  },
}

// The 7 diatonic chords in major key (semitone offsets from root + quality)
const MAJOR_SCALE_CHORDS = [
  { semitones: 0,  quality: '',   degree: 1 },  // I   major
  { semitones: 2,  quality: 'm',  degree: 2 },  // ii  minor
  { semitones: 4,  quality: 'm',  degree: 3 },  // iii minor
  { semitones: 5,  quality: '',   degree: 4 },  // IV  major
  { semitones: 7,  quality: '',   degree: 5 },  // V   major
  { semitones: 9,  quality: 'm',  degree: 6 },  // vi  minor
  { semitones: 11, quality: 'dim',degree: 7 },  // vii° dim
]

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function degreeToChordName(degree, keyRoot, keyMode = 'major') {
  if (!keyRoot) return null
  const keyPc = pitchClass(normalizeNote(keyRoot))
  if (keyPc === -1) return null
  const scaleChords = MAJOR_SCALE_CHORDS
  const entry = scaleChords.find(c => c.degree === degree)
  if (!entry) return null
  const chordPc = (keyPc + entry.semitones) % 12
  const root = PC_NAMES[chordPc]
  return root + entry.quality
}

// Pick a weighted random choice from { key: weight } object
function weightedPick(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  let r = Math.random() * total
  for (const [key, w] of Object.entries(weights)) {
    r -= w
    if (r <= 0) return Number(key)
  }
  return Number(Object.keys(weights)[0])
}

// ── Session learner ────────────────────────────────────────────────────────────
// Tracks bigrams (chord A → chord B) from the current session
export class ChordPredictor {
  constructor() {
    this.sessionBigrams = {}  // "A|B" → count
    this.history = []         // list of roman degree numbers
    this.keyRoot = null
    this.keyMode = 'major'
  }

  setKey(keyRoot, keyMode = 'major') {
    this.keyRoot = keyRoot
    this.keyMode = keyMode
  }

  // Call whenever a new chord is confirmed
  addChord(chordName) {
    const roman = this.keyRoot ? getRomanNumeral(chordName, this.keyRoot, this.keyMode) : null
    const degree = roman?.degree || null

    if (degree !== null) {
      // Record bigram
      if (this.history.length > 0) {
        const prev = this.history[this.history.length - 1]
        const key = `${prev}|${degree}`
        this.sessionBigrams[key] = (this.sessionBigrams[key] || 0) + 1
      }
      this.history.push(degree)
      // Keep last 32 chords
      if (this.history.length > 32) this.history.shift()
    }
  }

  // Get top N predictions for what comes next, with confidence scores
  predict(currentChordName, topN = 3) {
    if (!this.keyRoot) return []

    const roman = getRomanNumeral(currentChordName, this.keyRoot, this.keyMode)
    const fromDegree = roman?.degree
    if (!fromDegree) return []

    const baseWeights = { ...(MAJOR_TRANSITIONS[fromDegree] || {}) }

    // Boost weights from session learning
    for (let toDeg = 1; toDeg <= 7; toDeg++) {
      const sessionCount = this.sessionBigrams[`${fromDegree}|${toDeg}`] || 0
      if (sessionCount > 0) {
        baseWeights[toDeg] = (baseWeights[toDeg] || 0) + sessionCount * 15
      }
    }

    // Convert to sorted array of { degree, chordName, confidence }
    const total = Object.values(baseWeights).reduce((a, b) => a + b, 0)
    const predictions = Object.entries(baseWeights)
      .map(([deg, w]) => {
        const degree = Number(deg)
        const chordName = degreeToChordName(degree, this.keyRoot, this.keyMode)
        const roman = getRomanNumeral(chordName, this.keyRoot, this.keyMode)
        return {
          degree,
          chordName,
          romanLabel: roman?.label || '',
          confidence: total > 0 ? Math.round((w / total) * 100) : 0,
          isSessionLearned: (this.sessionBigrams[`${fromDegree}|${degree}`] || 0) > 0,
        }
      })
      .filter(p => p.chordName && p.degree !== fromDegree) // don't predict same chord
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topN)

    return predictions
  }

  reset() {
    this.sessionBigrams = {}
    this.history = []
  }
}
