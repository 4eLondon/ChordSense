import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(err) {
    return { error: err }
  }

  componentDidCatch(err, info) {
    console.error('ChordSense crash:', err, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0a0f',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', gap: '1.5rem', fontFamily: 'DM Sans, sans-serif',
        }}>
          <span style={{ fontSize: 40, opacity: 0.3 }}>⚠</span>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#f0f0f5', fontSize: 20, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 4 }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
              background: '#c8f55a', color: '#0a0a0f',
              fontSize: 14, fontWeight: 600, border: 'none',
            }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
