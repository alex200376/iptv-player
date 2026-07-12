import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  children: string
  className?: string
}

function measureText(text: string, font: string): number {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (!ctx) return text.length * 7
  ctx.font = font
  return ctx.measureText(text).width
}

export default function MarqueeText({ children, className }: Props) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [displayText, setDisplayText] = useState(children)
  const [overflows, setOverflows] = useState(false)

  const truncate = useCallback(() => {
    const el = outerRef.current
    if (!el) return
    const style = window.getComputedStyle(el)
    const font = style.font || `${style.fontSize} ${style.fontFamily}`
    const maxWidth = el.clientWidth
    if (maxWidth <= 0) return
    const fullWidth = measureText(children, font)
    if (fullWidth <= maxWidth) {
      setDisplayText(children)
      setOverflows(false)
      return
    }
    setOverflows(true)
    let low = 0
    let high = children.length
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      const w = measureText(children.slice(0, mid) + '...', font)
      if (w <= maxWidth) low = mid
      else high = mid - 1
    }
    setDisplayText(children.slice(0, low) + '...')
  }, [children])

  useEffect(() => { truncate() }, [truncate])

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const ro = new ResizeObserver(truncate)
    ro.observe(el)
    return () => ro.disconnect()
  }, [truncate])

  return (
    <div
      ref={outerRef}
      className={`overflow-hidden whitespace-nowrap min-w-0 w-full max-w-full ${overflows ? 'marquee-container' : ''} ${className}`}
      title={children}
    >
      <span className="marquee-text">{displayText}</span>
      {overflows && (
        <div className="flex marquee-animated" aria-hidden="true">
          <span>{children}</span>
          <span>{children}</span>
        </div>
      )}
    </div>
  )
}
