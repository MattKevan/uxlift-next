'use client'

import { CldImage } from 'next-cloudinary'
import { useState } from 'react'
import Image from 'next/image'
import clsx from 'clsx'

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
}

export function CustomImage({ 
  src, 
  alt, 
  width, 
  height, 
  className = '', 
  fallback = '/images/default-avatar.png',
  provider = 'cloudinary',
  priority = false,
  loading,
  sizes,
  quality = 75,
  placeholder,
  blurDataURL
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
