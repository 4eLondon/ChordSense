import { useState, useEffect } from 'react'

// Breakpoints
// xs: < 480  (small phones)
// sm: < 640  (phones)
// md: < 900  (tablets / large phones landscape)
// lg: >= 900 (desktop)

export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  useEffect(() => {
    let raf
    const handler = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setWidth(window.innerWidth))
    }
    window.addEventListener('resize', handler)
    return () => { window.removeEventListener('resize', handler); cancelAnimationFrame(raf) }
  }, [])

  return {
    width,
    isMobile:  width < 640,
    isTablet:  width >= 640 && width < 900,
    isDesktop: width >= 900,
    isSmall:   width < 480,
  }
}
