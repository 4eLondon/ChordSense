import React from 'react'
import { THEMES, ACCENTS, FONT_SIZES } from './useTheme'
import { useBreakpoint } from './useBreakpoint'

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

// ── Theme swatch ──────────────────────────────────────────────────────────────
function ThemeSwatch({ theme, isActive, onClick }) {
  const [bg, surface, accent] = theme.preview
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
      background: isActive ? 'var(--surface)' : 'transparent',
      border: `${isActive ? 1.5 : 0.5}px solid ${isActive ? 'var(--accent)' : 'var(--border2)'}`,
      alignItems: 'center', transition: 'all 0.15s', flex: 1,
      minWidth: 0,
    }}>
      {/* Mini preview */}
      <div style={{
        width: 42, height: 30, borderRadius: 7,
        background: bg, border: '0.5px solid rgba(128,128,128,0.2)',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ position:'absolute', bottom:5, left:5, right:5, height:4, background:surface, borderRadius:2 }}/>
        <div style={{ position:'absolute', bottom:5, right:6, width:10, height:4, background:accent, borderRadius:2 }}/>
      </div>
      <span style={{
        fontSize: 10, fontFamily: 'var(--font-mono)',
        color: isActive ? 'var(--accent)' : 'var(--text3)',
        letterSpacing: '0.04em',
      }}>
        {theme.name}
      </span>
    </button>
  )
}

// ── Accent dot ────────────────────────────────────────────────────────────────
function AccentDot({ accent, isActive, onClick }) {
  return (
    <button onClick={onClick} title={accent.name} style={{
      width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
      background: accent.accent,
      border: isActive ? `3px solid var(--text)` : `2px solid transparent`,
      boxShadow: isActive ? `0 0 0 1.5px ${accent.accent}` : 'none',
      transition: 'all 0.15s', flexShrink: 0,
      outline: 'none',
    }}/>
  )
}

// ── Font size pill ────────────────────────────────────────────────────────────
function SizePill({ size, isActive, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 4px', borderRadius: 9, cursor: 'pointer',
      background: isActive ? 'var(--surface)' : 'transparent',
      border: `${isActive ? 1.5 : 0.5}px solid ${isActive ? 'var(--accent)' : 'var(--border2)'}`,
      color: isActive ? 'var(--accent)' : 'var(--text3)',
      fontSize: { small: 11, normal: 13, large: 15 }[size.id],
      fontFamily: 'var(--font-body)',
      transition: 'all 0.15s',
    }}>
      {size.name}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ThemeSettings({ themeId, accentId, fontSizeId, onTheme, onAccent, onFontSize, onClose }) {
  const { isMobile } = useBreakpoint()

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 500,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: isMobile ? 'stretch' : 'center',
    padding: isMobile ? 0 : '1rem',
  }

  const panel = {
    background: 'var(--card-bg)',
    border: '0.5px solid var(--border2)',
    borderRadius: isMobile ? '20px 20px 0 0' : 20,
    padding: isMobile ? '1.25rem 1.25rem 2rem' : '1.5rem',
    width: isMobile ? '100%' : 380,
    maxHeight: isMobile ? '88vh' : '90vh',
    overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '1.5rem',
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={panel}>

        {/* Handle bar on mobile */}
        {isMobile && (
          <div style={{ width:36, height:4, background:'var(--border2)', borderRadius:2, margin:'-0.25rem auto 0' }}/>
        )}

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:600, color:'var(--text)', fontFamily:'var(--font-body)', margin:0 }}>
              Appearance
            </h2>
            <p style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)', marginTop:3 }}>
              Saved automatically
            </p>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:8,
            background:'var(--surface)', border:'0.5px solid var(--border)',
            color:'var(--text2)', display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer',
          }}>
            <CloseIcon/>
          </button>
        </div>

        {/* Theme presets */}
        <div>
          <p style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
            Theme
          </p>
          <div style={{ display:'flex', gap:6 }}>
            {Object.values(THEMES).map(t => (
              <ThemeSwatch key={t.id} theme={t} isActive={themeId===t.id} onClick={() => onTheme(t.id)}/>
            ))}
          </div>
        </div>

        {/* Accent color */}
        <div>
          <p style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
            Accent colour
          </p>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {Object.values(ACCENTS).map(a => (
              <div key={a.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <AccentDot accent={a} isActive={accentId===a.id} onClick={() => onAccent(a.id)}/>
                <span style={{ fontSize:9, fontFamily:'var(--font-mono)', color: accentId===a.id ? 'var(--accent)' : 'var(--text3)' }}>
                  {a.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div>
          <p style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
            Text size
          </p>
          <div style={{ display:'flex', gap:6 }}>
            {Object.values(FONT_SIZES).map(s => (
              <SizePill key={s.id} size={s} isActive={fontSizeId===s.id} onClick={() => onFontSize(s.id)}/>
            ))}
          </div>
        </div>

        {/* Preview strip */}
        <div style={{
          background: 'var(--bg3)', border: '0.5px solid var(--border)',
          borderRadius: 12, padding: '0.875rem 1rem',
        }}>
          <p style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:'0.625rem' }}>
            Preview
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:32, color:'var(--accent)', lineHeight:1 }}>C</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:32, color:'var(--accent)', lineHeight:1, opacity:.5 }}>→</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:32, color:'var(--text2)', lineHeight:1 }}>Am</span>
            <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', gap:3 }}>
              <span style={{ fontSize:12, color:'var(--text)', fontFamily:'var(--font-mono)' }}>Primary text</span>
              <span style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--font-mono)' }}>Secondary text</span>
              <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>Muted text</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
