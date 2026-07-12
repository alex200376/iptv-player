import { useLogoUrl } from '../hooks/useLogoUrl'

interface LogoImgProps {
  src?: string
  className?: string
}

export default function LogoImg({ src, className }: LogoImgProps) {
  const logoUrl = useLogoUrl(src)

  if (!src) return null

  return (
    <img
      src={logoUrl || src}
      alt=""
      loading="lazy"
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}
