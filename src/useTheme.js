import { useState, useEffect, useCallback } from 'react'

// ── Theme presets ─────────────────────────────────────────────────────────────
export const THEMES = {
  dark: {
    id: 'dark', name: 'Dark',
    preview: ['#0a0a0f', '#18181f', '#c8f55a'],
    vars: {
      '--bg':           '#0a0a0f',
      '--bg2':          '#111118',
      '--bg3':          '#18181f',
      '--bg4':          '#1e1e28',
      '--text':         '#f0f0f5',
      '--text2':        'rgba(255,255,255,0.55)',
      '--text3':        'rgba(255,255,255,0.32)',
      '--border':       'rgba(255,255,255,0.07)',
      '--border2':      'rgba(255,255,255,0.14)',
      '--surface':      'rgba(255,255,255,0.03)',
      '--header-bg':    'rgba(10,10,15,0.96)',
      '--card-bg':      '#111118',
      '--input-bg':     '#1e1e28',
      '--scrollbar':    'rgba(255,255,255,0.08)',
    },
  },
  soft: {
    id: 'soft', name: 'Soft',
    preview: ['#14141c', '#222230', '#c8f55a'],
    vars: {
      '--bg':           '#14141c',
      '--bg2':          '#1c1c28',
      '--bg3':          '#252534',
      '--bg4':          '#2e2e40',
      '--text':         '#eeeef8',
      '--text2':        'rgba(238,238,248,0.65)',
      '--text3':        'rgba(238,238,248,0.42)',
      '--border':       'rgba(255,255,255,0.10)',
      '--border2':      'rgba(255,255,255,0.18)',
      '--surface':      'rgba(255,255,255,0.04)',
      '--header-bg':    'rgba(20,20,28,0.97)',
      '--card-bg':      '#1c1c28',
      '--input-bg':     '#2e2e40',
      '--scrollbar':    'rgba(255,255,255,0.10)',
    },
  },
  midnight: {
    id: 'midnight', name: 'Midnight',
    preview: ['#080d18', '#141d2e', '#5ab8f5'],
    vars: {
      '--bg':           '#080d18',
      '--bg2':          '#0e1524',
      '--bg3':          '#141d2e',
      '--bg4':          '#1c273c',
      '--text':         '#ddeeff',
      '--text2':        'rgba(180,210,255,0.65)',
      '--text3':        'rgba(180,210,255,0.38)',
      '--border':       'rgba(100,160,255,0.10)',
      '--border2':      'rgba(100,160,255,0.20)',
      '--surface':      'rgba(100,160,255,0.04)',
      '--header-bg':    'rgba(8,13,24,0.97)',
      '--card-bg':      '#0e1524',
      '--input-bg':     '#1c273c',
      '--scrollbar':    'rgba(100,160,255,0.12)',
    },
  },
  warm: {
    id: 'warm', name: 'Warm',
    preview: ['#100e0b', '#221c14', '#f5b85a'],
    vars: {
      '--bg':           '#100e0b',
      '--bg2':          '#1a1510',
      '--bg3':          '#241d16',
      '--bg4':          '#2e251c',
      '--text':         '#f5ede0',
      '--text2':        'rgba(245,237,224,0.62)',
      '--text3':        'rgba(245,237,224,0.38)',
      '--border':       'rgba(255,200,100,0.09)',
      '--border2':      'rgba(255,200,100,0.18)',
      '--surface':      'rgba(255,200,100,0.03)',
      '--header-bg':    'rgba(16,14,11,0.97)',
      '--card-bg':      '#1a1510',
      '--input-bg':     '#2e251c',
      '--scrollbar':    'rgba(255,200,100,0.10)',
    },
  },
  light: {
    id: 'light', name: 'Light',
    preview: ['#f0f0f5', '#ffffff', '#5a8a00'],
    vars: {
      '--bg':           '#f0f0f5',
      '--bg2':          '#ffffff',
      '--bg3':          '#e8e8ef',
      '--bg4':          '#dcdce6',
      '--text':         '#0c0c18',
      '--text2':        'rgba(12,12,24,0.62)',
      '--text3':        'rgba(12,12,24,0.40)',
      '--border':       'rgba(0,0,0,0.09)',
      '--border2':      'rgba(0,0,0,0.16)',
      '--surface':      'rgba(0,0,0,0.03)',
      '--header-bg':    'rgba(240,240,245,0.97)',
      '--card-bg':      '#ffffff',
      '--input-bg':     '#e8e8ef',
      '--scrollbar':    'rgba(0,0,0,0.12)',
    },
  },
}

// ── Accent color presets ──────────────────────────────────────────────────────
export const ACCENTS = {
  lime:   { id:'lime',   name:'Lime',   accent:'#c8f55a', accent2:'#a8d93a', accentDark:'#2a5500' },
  sky:    { id:'sky',    name:'Sky',    accent:'#5ab8f5', accent2:'#3a96d9', accentDark:'#003566' },
  violet: { id:'violet', name:'Violet', accent:'#b06bff', accent2:'#9050e0', accentDark:'#3a0066' },
  amber:  { id:'amber',  name:'Amber',  accent:'#f5c85a', accent2:'#d9a83a', accentDark:'#664400' },
  rose:   { id:'rose',   name:'Rose',   accent:'#f55a8a', accent2:'#d93a6a', accentDark:'#660030' },
  teal:   { id:'teal',   name:'Teal',   accent:'#5af5c8', accent2:'#3ad9a8', accentDark:'#006644' },
}

// ── Font size options ─────────────────────────────────────────────────────────
export const FONT_SIZES = {
  small:  { id:'small',  name:'Small',  scale: 0.88 },
  normal: { id:'normal', name:'Normal', scale: 1.00 },
  large:  { id:'large',  name:'Large',  scale: 1.14 },
}

// ── Apply theme to DOM ────────────────────────────────────────────────────────
function applyTheme(themeId, accentId, fontSizeId) {
  const theme  = THEMES[themeId]  || THEMES.dark
  const accent = ACCENTS[accentId]|| ACCENTS.lime
  const size   = FONT_SIZES[fontSizeId] || FONT_SIZES.normal
  const root   = document.documentElement

  // Theme variables
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v))

  // Accent variables
  root.style.setProperty('--accent',      accent.accent)
  root.style.setProperty('--accent2',     accent.accent2)
  root.style.setProperty('--accent-dark', accent.accentDark)

  // In light mode, override accent colors for better contrast
  if (themeId === 'light') {
    // Darken accents significantly so they're visible on white
    const darkened = {
      lime:   '#4a7a00', sky:  '#0060a0',
      violet: '#6020c0', amber:'#8a5500',
      rose:   '#900040', teal: '#007755',
    }
    const d = darkened[accentId] || darkened.lime
    root.style.setProperty('--accent',  d)
    root.style.setProperty('--accent2', d)
    root.style.setProperty('--red',    '#cc2200')
    root.style.setProperty('--blue',   '#0055cc')
    root.style.setProperty('--purple', '#6600cc')
    root.style.setProperty('--yellow', '#996600')
  } else {
    root.style.setProperty('--red',    '#ff6b6b')
    root.style.setProperty('--blue',   '#6bb5ff')
    root.style.setProperty('--purple', '#b06bff')
    root.style.setProperty('--yellow', '#f5c84a')
  }

  // Font size scale
  root.style.setProperty('--font-scale', String(size.scale))
  root.style.fontSize = `${size.scale * 16}px`

  // Body background
  document.body.style.background = theme.vars['--bg']
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useTheme() {
  const [themeId,    setThemeId]    = useState(() => localStorage.getItem('cs-theme')    || 'dark')
  const [accentId,   setAccentId]   = useState(() => localStorage.getItem('cs-accent')   || 'lime')
  const [fontSizeId, setFontSizeId] = useState(() => localStorage.getItem('cs-fontsize') || 'normal')

  // Apply on mount + whenever settings change
  useEffect(() => {
    applyTheme(themeId, accentId, fontSizeId)
    localStorage.setItem('cs-theme',    themeId)
    localStorage.setItem('cs-accent',   accentId)
    localStorage.setItem('cs-fontsize', fontSizeId)
  }, [themeId, accentId, fontSizeId])

  // Helper: read current CSS var value (for canvas/SVG that can't use var())
  const getCSSVar = useCallback((name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }, [])

  return {
    themeId, setThemeId,
    accentId, setAccentId,
    fontSizeId, setFontSizeId,
    getCSSVar,
    theme:    THEMES[themeId]   || THEMES.dark,
    accent:   ACCENTS[accentId] || ACCENTS.lime,
    fontSize: FONT_SIZES[fontSizeId] || FONT_SIZES.normal,
    isLight:  themeId === 'light',
  }
}
