import React, { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Capture the browser's install prompt event
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      // Only show if not already installed and not dismissed before
      if (!localStorage.getItem('pwa-dismissed')) {
        setShow(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Hide if already installed
    window.addEventListener('appinstalled', () => {
      setShow(false)
      setInstalled(true)
    })

    // iOS Safari detection (no beforeinstallprompt on iOS)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInStandalone = window.navigator.standalone === true
    if (isIOS && !isInStandalone && !localStorage.getItem('pwa-dismissed')) {
      setShow(true) // show manual instructions for iOS
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (prompt) {
      prompt.prompt()
      const result = await prompt.userChoice
      if (result.outcome === 'accepted') setInstalled(true)
    }
    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa-dismissed', '1')
    setShow(false)
  }

  if (!show) return null

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 400, width: 'calc(100% - 2rem)', maxWidth: 400,
      background: 'var(--bg2)', border: '1px solid var(--border2)',
      borderRadius: 16, padding: '1rem 1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>♪</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
            Install ChordSense
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
            {isIOS
              ? 'Tap the Share button then "Add to Home Screen" to use offline'
              : 'Add to your home screen for offline use — works without internet'
            }
          </p>
        </div>
        <button onClick={handleDismiss} style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text3)', background: 'var(--bg4)', border: 'none',
          cursor: 'pointer', fontSize: 14,
        }}>✕</button>
      </div>

      {!isIOS && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDismiss} style={{
            flex: 1, padding: '8px', borderRadius: 9, cursor: 'pointer',
            background: 'transparent', border: '0.5px solid var(--border2)',
            color: 'var(--text3)', fontSize: 13,
          }}>Not now</button>
          <button onClick={handleInstall} style={{
            flex: 2, padding: '8px', borderRadius: 9, cursor: 'pointer',
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', fontSize: 13, fontWeight: 600,
          }}>Install app</button>
        </div>
      )}
    </div>
  )
}
