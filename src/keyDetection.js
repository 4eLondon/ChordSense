/**
 * keyDetection.js
 *
 * Three algorithms run simultaneously and vote:
 *
 * 1. Krumhansl-Schmuckler (KS)  — correlates pitch-class energy against
 *    tonal hierarchy profiles. Gold standard in music cognition research.
 *
 * 2. Chord-fit scoring           — scores all 24 keys by how well the
 *    detected chords fit as diatonic chords in that key.
 *
 * 3. Pitch-class histogram       — simple note-frequency weighting.
 *    Tonic tends to appear most, leading tone least.
 *
 * Returns:
 *   { key, mode, confidence, scale, scaleChords, alternates }
 */

// ── Krumhansl-Schmuckler tonal hierarchy profiles ────────────────────────────
// Values represent how well each pitch class fits in C major / C minor
// (rotate for other keys)
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

// Pearson correlation coefficient
function pearson(a, b) {
  const n = a.length
  const meanA = a.reduce((s,v)=>s+v,0)/n
  const meanB = b.reduce((s,v)=>s+v,0)/n
  let num=0, da=0, db=0
  for (let i=0;i<n;i++){
    const xa=a[i]-meanA, xb=b[i]-meanB
    num+=xa*xb; da+=xa*xa; db+=xb*xb
  }
  return (da===0||db===0) ? 0 : num/Math.sqrt(da*db)
}

function ksScores(pcEnergy) {
  const results = []
  for (let root=0;root<12;root++){
    // Rotate profile to match this root
    const majProfile = KS_MAJOR.map((_,i)=>KS_MAJOR[(i-root+12)%12])
    const minProfile = KS_MINOR.map((_,i)=>KS_MINOR[(i-root+12)%12])
    results.push({ root, mode:'major', score: pearson([...pcEnergy], majProfile) })
    results.push({ root, mode:'minor', score: pearson([...pcEnergy], minProfile) })
  }
  return results
}

// ── Scale/chord tables ────────────────────────────────────────────────────────
const MAJOR_INTERVALS = [0,2,4,5,7,9,11]
const MINOR_INTERVALS = [0,2,3,5,7,8,10]
const MAJOR_QUALITIES = ['maj','min','min','maj','dom7','min','dim']
const MINOR_QUALITIES = ['min','dim','maj','min','min','maj','dom7']
const MAJOR_ROMAN     = ['I','ii','iii','IV','V','vi','vii°']
const MINOR_ROMAN     = ['i','ii°','III','iv','v','VI','VII']

export function buildScale(root, mode) {
  const intervals = mode==='minor' ? MINOR_INTERVALS : MAJOR_INTERVALS
  const qualities = mode==='minor' ? MINOR_QUALITIES : MAJOR_QUALITIES
  const romans    = mode==='minor' ? MINOR_ROMAN     : MAJOR_ROMAN
  return intervals.map((s,i)=>{
    const pc = (root+s)%12
    const noteName = NOTE_NAMES[pc]
    const q = qualities[i]
    const chordName = q==='maj'  ? noteName
                    : q==='min'  ? noteName+'m'
                    : q==='dim'  ? noteName+'dim'
                    : q==='dom7' ? noteName+'7'
                    : noteName
    return { pc, note: noteName, roman: romans[i], quality: q, chord: chordName, degree: i+1 }
  })
}

// ── Chord-fit scoring ─────────────────────────────────────────────────────────
// For each chord in history, check if its root fits diatonically in this key
// Diatonic match = +1.0, chromatic neighbour = +0.2, outside = 0
function chordFitScore(chordHistory, root, mode) {
  if (!chordHistory.length) return 0
  const scale = buildScale(root, mode)
  const scalePCs = new Set(scale.map(s=>s.pc))
  const scaleRoots = new Set(scale.map(s=>s.pc))
  let score = 0
  let count = 0
  chordHistory.slice(0,30).forEach(({ chord })=>{
    const m = chord?.match(/^([A-G][#b]?)/)
    if (!m) return
    const noteName = m[1].replace('Bb','A#').replace('Eb','D#').replace('Ab','G#')
                          .replace('Db','C#').replace('Gb','F#')
    const pc = NOTE_NAMES.indexOf(noteName)
    if (pc===-1) return
    if (scaleRoots.has(pc)) score += 1.0
    else if (scalePCs.has((pc+1)%12) || scalePCs.has((pc+11)%12)) score += 0.15
    count++
  })
  return count ? score/count : 0
}

// ── Histogram scoring ─────────────────────────────────────────────────────────
// Tonic usually has highest energy; leading tone (VII in major) usually lowest
function histogramScore(pcEnergy, root, mode) {
  const intervals = mode==='minor' ? MINOR_INTERVALS : MAJOR_INTERVALS
  // Weight each scale degree by expected prominence
  const weights = mode==='minor'
    ? [1.0, 0.3, 0.6, 0.7, 0.8, 0.5, 0.4]   // i ii° III iv v VI VII
    : [1.0, 0.5, 0.4, 0.8, 0.9, 0.6, 0.2]   // I ii iii IV V vi vii°
  let score = 0
  intervals.forEach((s,i)=>{
    const pc = (root+s)%12
    score += (pcEnergy[pc]||0) * weights[i]
  })
  return score
}

// ── Main detection function ───────────────────────────────────────────────────
export function detectKey(pcEnergy, chordHistory=[]) {
  const totalEnergy = [...pcEnergy].reduce((a,b)=>a+b,0)
  const hasEnergy   = totalEnergy > 50
  const hasChords   = chordHistory.length >= 2

  // Normalize energy
  const norm = totalEnergy > 0
    ? [...pcEnergy].map(v=>v/totalEnergy)
    : new Array(12).fill(1/12)

  // ── 1. K-S algorithm ──────────────────────────────────────────────────────
  const ksResults = ksScores(norm)
  const ksMax     = Math.max(...ksResults.map(r=>r.score))
  const ksMin     = Math.min(...ksResults.map(r=>r.score))
  const ksRange   = ksMax - ksMin || 1

  // ── 2. Chord fit ──────────────────────────────────────────────────────────
  const chordFits = []
  for (let root=0;root<12;root++){
    for (const mode of ['major','minor']){
      chordFits.push({ root, mode, score: chordFitScore(chordHistory, root, mode) })
    }
  }
  const cfMax   = Math.max(...chordFits.map(r=>r.score)) || 1

  // ── 3. Histogram ──────────────────────────────────────────────────────────
  const histScores = []
  for (let root=0;root<12;root++){
    for (const mode of ['major','minor']){
      histScores.push({ root, mode, score: histogramScore(norm, root, mode) })
    }
  }
  const histMax = Math.max(...histScores.map(r=>r.score)) || 1

  // ── Blend weights depend on how much data we have ─────────────────────────
  // More chords → trust chord-fit more. More audio → trust K-S more.
  const ksWeight    = hasEnergy  ? 0.45 : 0.10
  const chordWeight = hasChords  ? 0.45 : 0.10
  const histWeight  = 0.10

  // Build combined scores for all 24 keys
  const combined = []
  for (let root=0;root<12;root++){
    for (const mode of ['major','minor']){
      const ks  = ksResults.find(r=>r.root===root&&r.mode===mode)
      const cf  = chordFits.find(r=>r.root===root&&r.mode===mode)
      const hs  = histScores.find(r=>r.root===root&&r.mode===mode)

      const ksNorm   = ksRange  > 0 ? (ks.score  - ksMin)  / ksRange  : 0
      const cfNorm   = cfMax    > 0 ? cf.score / cfMax   : 0
      const histNorm = histMax  > 0 ? hs.score / histMax : 0

      const total = ksNorm*ksWeight + cfNorm*chordWeight + histNorm*histWeight
      combined.push({ root, mode, score: total, ksScore: ks.score, cfScore: cf.score })
    }
  }

  combined.sort((a,b)=>b.score-a.score)

  const winner    = combined[0]
  const runnerUp  = combined[1]
  const third     = combined[2]

  // Confidence: how far ahead is the winner?
  const scoreRange  = combined[0].score - combined[combined.length-1].score || 1
  const margin      = (winner.score - runnerUp.score) / scoreRange
  // Scale to 0.3–1.0 range so UI always shows something meaningful
  const confidence  = Math.min(1, 0.30 + margin * 2.2)

  // Label confidence
  const confidenceLabel = confidence >= 0.80 ? 'High'
                        : confidence >= 0.55 ? 'Likely'
                        : confidence >= 0.35 ? 'Possible'
                        : 'Uncertain'

  const scale = buildScale(winner.root, winner.mode)

  // Alternates: top 3 other keys (excluding enharmonic equivalents of winner)
  const alternates = combined.slice(1,5)
    .filter(r=>{
      // Skip if same root different mode (show separately)
      if (r.root===winner.root) return true
      // Skip pure enharmonics: C# and Db are the same pitch
      return true
    })
    .slice(0,3)
    .map(r=>({
      key: NOTE_NAMES[r.root],
      mode: r.mode,
      score: r.score,
    }))

  return {
    key:            NOTE_NAMES[winner.root],
    root:           winner.root,
    mode:           winner.mode,
    confidence,
    confidenceLabel,
    scale,
    alternates,
    // Raw scores for debug display
    ksScore:        winner.ksScore,
    cfScore:        winner.cfScore,
  }
}

// ── Common chord movements per degree ────────────────────────────────────────
// For each degree in major/minor, the most idiomatic next degrees
const MAJOR_MOVEMENTS = {
  1: [{ to:4,label:'IV',desc:'Subdominant — very common'    },
      { to:5,label:'V', desc:'Dominant — strong pull'       },
      { to:6,label:'vi',desc:'Relative minor — smooth move' },
      { to:2,label:'ii',desc:'Pre-dominant'                 }],
  2: [{ to:5,label:'V', desc:'ii→V — classic jazz/pop move' },
      { to:4,label:'IV',desc:'Subdominant'                  }],
  3: [{ to:4,label:'IV',desc:'Step up'                      },
      { to:6,label:'vi',desc:'iii→vi turnaround'            }],
  4: [{ to:5,label:'V', desc:'IV→V — strongest cadence'     },
      { to:1,label:'I', desc:'Plagal cadence'               },
      { to:2,label:'ii',desc:'Substitute'                   }],
  5: [{ to:1,label:'I', desc:'Authentic cadence — resolves' },
      { to:6,label:'vi',desc:'Deceptive cadence'            }],
  6: [{ to:4,label:'IV',desc:'vi→IV — emotional move'       },
      { to:2,label:'ii',desc:'Secondary pre-dominant'       },
      { to:5,label:'V', desc:'vi→V'                         }],
  7: [{ to:1,label:'I', desc:'Leading tone resolves up'     }],
}
const MINOR_MOVEMENTS = {
  1: [{ to:6,label:'VI',desc:'i→VI — natural minor move'    },
      { to:7,label:'VII',desc:'Subtonic'                    },
      { to:4,label:'iv', desc:'Minor subdominant'           },
      { to:5,label:'v/V',desc:'To dominant'                 }],
  2: [{ to:5,label:'v',  desc:'Half-dim resolves to v'      }],
  3: [{ to:6,label:'VI', desc:'III→VI'                      },
      { to:7,label:'VII',desc:'Step up'                     }],
  4: [{ to:5,label:'v',  desc:'iv→v minor move'             },
      { to:1,label:'i',  desc:'Plagal'                      }],
  5: [{ to:1,label:'i',  desc:'v→i — minor cadence'         },
      { to:6,label:'VI', desc:'Deceptive'                   }],
  6: [{ to:7,label:'VII',desc:'VI→VII — common rock move'   },
      { to:3,label:'III',desc:'VI→III'                      }],
  7: [{ to:1,label:'i',  desc:'VII→i — natural resolution'  },
      { to:6,label:'VI', desc:'VII→VI'                      }],
}

export function getMovementsForChord(chordName, scale) {
  if (!chordName || !scale) return []
  const m = chordName.match(/^([A-G][#b]?)/)
  if (!m) return []
  const rootNote = m[1].replace('Bb','A#').replace('Eb','D#').replace('Ab','G#')
                        .replace('Db','C#').replace('Gb','F#')
  const pc = NOTE_NAMES.indexOf(rootNote)
  const entry = scale.find(s=>s.pc===pc)
  if (!entry) return []
  const table = scale[0]?.quality === 'min' ? MINOR_MOVEMENTS : MAJOR_MOVEMENTS
  const moves = table[entry.degree] || []
  return moves.map(mv=>{
    const target = scale[mv.to-1]
    return { ...mv, targetChord: target?.chord || mv.label, targetNote: target?.note }
  })
}
