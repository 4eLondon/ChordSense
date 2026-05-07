import React, { useState } from 'react'
import { FILTER_MODES } from './musicTheory'

export default function FilterModeSelector({ activeId, onChange, keyRoot }) {
  const [open, setOpen] = useState(false)
  const active = FILTER_MODES.find(m => m.id === activeId) || FILTER_MODES[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 8,
          fontSize: 13, color: activeId !== 'all' ? 'var(--purple)' : 'var(--text2)',
          background: activeId !== 'all' ? 'rgba(176,107,255,0.10)' : 'var(--bg3)',
          border: `0.5px solid ${activeId !== 'all' ? 'rgba(176,107,255,0.30)' : 'var(--border)'}`,
          transition: 'all 0.15s', whiteSpace: 'nowrap', cursor: 'pointer',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
        </svg>
        {active.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}>
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--bg3)', border: '0.5px solid var(--border2)',
            borderRadius: 14, padding: '6px', zIndex: 200,
            minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {!keyRoot && (
              <div style={{
                padding: '6px 10px 10px',
                fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)',
                borderBottom: '0.5px solid var(--border)', marginBottom: 6,
              }}>
                Tip: upload a file first to enable degree filters
              </div>
            )}
            {FILTER_MODES.map(mode => {
              const needsKey = mode.degrees && !keyRoot
              return (
                <button
                  key={mode.id}
                  onClick={() => { onChange(mode.id); setOpen(false) }}
                  disabled={needsKey}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    width: '100%', textAlign: 'left',
                    padding: '9px 12px', borderRadius: 9,
                    background: activeId === mode.id ? 'rgba(176,107,255,0.12)' : 'transparent',
                    border: activeId === mode.id ? '0.5px solid rgba(176,107,255,0.25)' : '0.5px solid transparent',
                    cursor: needsKey ? 'not-allowed' : 'pointer',
                    opacity: needsKey ? 0.4 : 1,
                    transition: 'all 0.1s',
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (!needsKey && activeId !== mode.id) e.currentTarget.style.background = 'var(--bg4)' }}
                  onMouseLeave={e => { if (activeId !== mode.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 14, fontWeight: 500,
                      color: activeId === mode.id ? 'var(--purple)' : 'var(--text)',
                    }}>
                      {mode.label}
                    </span>
                    {activeId === mode.id && (
                      <span style={{ color: 'var(--purple)', fontSize: 12 }}>✓</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{mode.description}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
