import React, { useState, useRef, useEffect } from 'react'
import { FILTER_MODES } from './musicTheory'

export default function FilterPills({ activeId, onChange, keyRoot }) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const active = FILTER_MODES.find(m => m.id === activeId) || FILTER_MODES[0]

  const calcPos = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 8, left: r.left })
    }
  }

  const handleOpen = () => {
    if (!open) calcPos()
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const update = () => calcPos()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          fontSize: 12, cursor: 'pointer',
          color: activeId !== 'all' ? 'var(--purple)' : 'var(--text2)',
          background: activeId !== 'all' ? 'rgba(176,107,255,0.10)' : 'rgba(255,255,255,0.05)',
          border: `0.5px solid ${activeId !== 'all' ? 'rgba(176,107,255,0.30)' : 'rgba(255,255,255,0.10)'}`,
          fontFamily: 'var(--font-mono)',
          transition: 'all 0.15s',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="11" y1="18" x2="13" y2="18"/>
        </svg>
        {active.label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>

      {open && (
        <>
          {/* Full-screen backdrop */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setOpen(false)} />

          {/* Dropdown — fixed so it escapes sticky header overflow */}
          <div style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            background: '#1a1a24',
            border: '0.5px solid rgba(255,255,255,0.14)',
            borderRadius: 14,
            padding: 6,
            zIndex: 300,
            minWidth: 252,
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          }}>
            {!keyRoot && (
              <p style={{
                padding: '6px 10px 10px', fontSize: 11,
                color: 'var(--text3)', fontFamily: 'var(--font-mono)',
                borderBottom: '0.5px solid rgba(255,255,255,0.07)',
                marginBottom: 6,
              }}>
                Upload a song first to enable degree filters
              </p>
            )}
            {FILTER_MODES.map(mode => {
              const needsKey = mode.degrees && !keyRoot
              const isActive = activeId === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => { onChange(mode.id); setOpen(false) }}
                  disabled={needsKey}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', borderRadius: 9, marginBottom: 2,
                    cursor: needsKey ? 'not-allowed' : 'pointer',
                    background: isActive ? 'rgba(176,107,255,0.12)' : 'transparent',
                    border: isActive ? '0.5px solid rgba(176,107,255,0.25)' : '0.5px solid transparent',
                    opacity: needsKey ? 0.35 : 1,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!needsKey && !isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: 500, marginBottom: 2,
                    color: isActive ? 'var(--purple)' : 'var(--text)',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    {mode.label}
                    {isActive && <span style={{ color: 'var(--purple)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{mode.description}</div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
