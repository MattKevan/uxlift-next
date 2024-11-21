// components/Image.tsx
'use client'

import { CldImage } from 'next-cloudinary'
import { useState } from 'react'
import Image from 'next/image'
import clsx from 'clsx'

type CloudinaryTransformation = {
  crop?: "auto" | "crop" | "fill" | "fill_pad" | "fit" | "imagga_crop" | "imagga_scale" | "lfill" | "limit" | "lpad" | "mfit" | "mpad" | "pad" | "scale" | "thumb"
  gravity?: "auto" | "custom" | "auto_content_aware" | "center" | "east" | "face" | "face_center" | "multi_face" | "north" | "north_east" | "north_west" | "south" | "south_east" | "south_west" | "west"
  aspectRatio?: string | number
}

interface ImageProps {
  src: string | null
  alt: string
  width: number
  height: number
  className?: string
  fallback?: string
  provider?: 'cloudinary' | 'default'
  priority?: boolean
  loading?: 'lazy' | 'eager'
  sizes?: string
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  options?: CloudinaryTransformation
}

export function CustomImage({ 
  src, 
  alt, 
  width, 
  height, 
  className = '', 
  fallback = '/default-avatar.png',
  provider = 'cloudinary',
  priority = false,
  loading,
  sizes,
  quality = 75,
  placeholder,
  blurDataURL,
  options
}: ImageProps) {
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const imageClasses = clsx(
    className,
    isLoading && 'animate-pulse bg-gray-200'
  )

  if (!src || error) {
    return (
      <img
        src={fallback}
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    )
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  if (provider === 'cloudinary') {
    return (
      <CldImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={imageClasses}
        onError={() => setError(true)}
        onLoad={handleLoad}
        priority={priority}
        loading={loading}
        sizes={sizes}
        {...options}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={imageClasses}
      onError={() => setError(true)}
      onLoad={handleLoad}
      priority={priority}
      loading={loading}
      sizes={sizes}
      quality={quality}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
    />
  )
}
