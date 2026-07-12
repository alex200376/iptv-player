import { useState, useEffect } from 'react'

export function useLogoUrl(originalUrl: string | undefined): string | undefined {
  const [url, setUrl] = useState(originalUrl)

  useEffect(() => {
    if (!originalUrl) {
      setUrl(undefined)
      return
    }

    setUrl(originalUrl)

    let cancelled = false
    window.electronAPI.getLogoUrl(originalUrl).then((resolved) => {
      if (!cancelled) setUrl(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [originalUrl])

  return url
}
