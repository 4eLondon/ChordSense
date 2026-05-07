import React, { useState } from 'react'
import { saveSession, isSupabaseConfigured } from './supabase'

export default function SaveModal({ onClose, chordHistory, songKey, bpm, mode }) {
  const [songName, setSongName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  const handleSave = async () => {
    if (!songName.trim()) return
    setSaving(true)
    setErr(null)
    const chords = chordHistory.map(h => h.chord)
    const { error } = await saveSession({ songName: songName.trim(), chords, key: songKey, bpm, mode })
    setSaving(false)
    if (error) {
      setErr(typeof error === 'string' ? error : error.message)
    } else {
      setSaved(true)
      setTimeout(onClose, 1200)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg3)', border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 400, margin: '0 1rem',
        }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: '0.25rem' }}>
          Save session
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
          {chordHistory.length} chords detected
          {songKey ? ` · Key of ${songKey}` : ''}
          {bpm ? ` · ~${bpm} BPM` : ''}
        </p>

        {!isSupabaseConfigured && (
          <div style={{
            background: 'rgba(255,107,107,0.1)', border: '0.5px solid rgba(255,107,107,0.3)',
            borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: 13,
            color: 'var(--red)',
          }}>
            Supabase is not configured yet. Add your keys to <code>.env.local</code> to enable saving.
          </div>
        )}

        <input
          type="text"
          placeholder="Song or session name…"
          value={songName}
          onChange={e => setSongName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          disabled={!isSupabaseConfigured}
          style={{
            width: '100%', background: 'var(--bg4)', border: '0.5px solid var(--border2)',
            borderRadius: 10, padding: '0.75rem 1rem', color: 'var(--text)',
            fontSize: 15, fontFamily: 'var(--font-body)', marginBottom: '1rem',
            outline: 'none',
          }}
        />

        {err && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: '1rem' }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: 10,
              border: '0.5px solid var(--border2)', color: 'var(--text2)',
              fontSize: 14, background: 'transparent',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!songName.trim() || saving || !isSupabaseConfigured}
            style={{
              flex: 2, padding: '0.75rem', borderRadius: 10,
              background: saved ? 'rgba(200,245,90,0.2)' : 'var(--accent)',
              color: saved ? 'var(--accent)' : '#0a0a0f',
              fontSize: 14, fontWeight: 500,
              opacity: (!songName.trim() || !isSupabaseConfigured) ? 0.4 : 1,
              border: saved ? '0.5px solid var(--accent)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
