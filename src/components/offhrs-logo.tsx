import Image from 'next/image'
import Link from 'next/link'

/** Official wordmark — add `public/logo.png` (same asset as the consumer homepage hero). */
export const OFFHRS_LOGO_SRC = '/logo.png'
export const OFFHRS_LOGO_ALT = 'offhrs'

type OffhrsLogoProps = {
  className?: string
  width?: number
  height?: number
  priority?: boolean
}

export function OffhrsLogo({
  className = 'h-8 w-auto max-w-[160px] object-contain object-left',
  width = 200,
  height = 48,
  priority = false,
}: OffhrsLogoProps) {
  return (
    <Image
      src={OFFHRS_LOGO_SRC}
      alt={OFFHRS_LOGO_ALT}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  )
}

type OffhrsLogoLinkProps = OffhrsLogoProps & {
  href: string
  linkClassName?: string
}

export function OffhrsLogoLink({
  href,
  linkClassName = 'inline-flex items-center shrink-0',
  ...logoProps
}: OffhrsLogoLinkProps) {
  return (
    <Link href={href} className={linkClassName}>
      <OffhrsLogo {...logoProps} />
    </Link>
  )
}
