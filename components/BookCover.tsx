'use client'

import { CldImage } from 'next-cloudinary'

interface BookCoverProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}

export function BookCover({ src, alt, width, height, className }: BookCoverProps) {
  return <CldImage src={src} alt={alt} width={width} height={height} className={className} />
}
