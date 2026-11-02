import { useEffect, useState } from 'react'

export default function usePublicLoader(duration = 650) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), duration)
    return () => window.clearTimeout(timer)
  }, [duration])
  return loading
}
