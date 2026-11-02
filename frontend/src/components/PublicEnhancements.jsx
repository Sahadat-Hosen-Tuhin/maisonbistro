import { useEffect, useRef } from 'react'

export function ScrollReveal({ children }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const sections = node.querySelectorAll('section')
    sections.forEach((section) => section.classList.add('reveal-section'))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className="public-reveal-page">{children}</div>
}

export function LogoLoader({ label = 'Preparing something delicious...' }) {
  return <div className="logo-loader" role="status" aria-live="polite"><div className="logo-loader-ring"><img src="/images/logo.png" alt="" /></div><span>{label}</span></div>
}
