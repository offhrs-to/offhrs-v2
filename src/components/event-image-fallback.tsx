'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getCategoryNoviceIconPath } from '@/constants/categories'

type Base = {
  imageUrl: string | null | undefined
  category: string | null | undefined
  alt: string
  sizes?: string
  imageClassName?: string
}

type EventImageFallbackProps =
  | (Base & {
      mode: 'fill'
      /** Applied to the primary photo when it loads */
      imageClassName?: string
    })
  | (Base & {
      mode: 'fixed'
      width: number
      height: number
      imageClassName?: string
    })

/**
 * Shows the event image when available; on load error or empty URL, shows the category Novice icon.
 */
export function EventImageFallback(props: EventImageFallbackProps) {
  const [failed, setFailed] = useState(false)
  const { imageUrl, category, alt } = props
  const trimmed = imageUrl?.trim() ?? ''
  const showFallback = !trimmed || failed
  const noviceSrc = getCategoryNoviceIconPath(category)

  if (showFallback) {
    if (props.mode === 'fill') {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <Image
            src={noviceSrc}
            alt=""
            aria-hidden
            fill
            sizes={props.sizes ?? '(max-width: 768px) 100vw, 33vw'}
            className="object-contain p-6"
          />
        </div>
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <Image
          src={noviceSrc}
          alt=""
          width={props.width}
          height={props.height}
          sizes={props.sizes}
          className="max-h-full max-w-full object-contain p-2"
        />
      </div>
    )
  }

  if (props.mode === 'fill') {
    return (
      <Image
        src={trimmed}
        alt={alt}
        fill
        sizes={props.sizes ?? '(max-width: 768px) 100vw, 33vw'}
        onError={() => setFailed(true)}
        className={props.imageClassName}
      />
    )
  }

  return (
    <Image
      src={trimmed}
      alt={alt}
      width={props.width}
      height={props.height}
      sizes={props.sizes}
      onError={() => setFailed(true)}
      className={props.imageClassName ?? 'h-full w-full object-cover'}
    />
  )
}
