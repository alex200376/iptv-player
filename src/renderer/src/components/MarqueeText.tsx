import { useRef, useState, useEffect } from 'react'

interface Props {
  children: string
  className?: string
}

export default function MarqueeText({ children, className }: Props) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [dist, setDist] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (outer && inner) {
      const d = inner.scrollWidth - outer.offsetWidth
      if (d > 0) {
        setOverflows(true)
        setDist(d)
      } else {
        setOverflows(false)
      }
    }
  }, [children])

  return (
    <div
      ref={outerRef}
      className={`overflow-hidden whitespace-nowrap ${overflows ? 'marquee-container' : ''} ${className}`}
      title={children}
      style={
        overflows
          ? ({
              '--marquee-dist': `-${dist}px`,
              '--marquee-dur': `${Math.max(4, dist / 40)}s`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <span
        ref={innerRef}
        className={overflows ? 'marquee-hover' : 'block truncate'}
      >
        {children}
      </span>
    </div>
  )
}
