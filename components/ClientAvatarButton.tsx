'use client'

import { AvatarButton } from '@/components/catalyst/avatar'
import { DropdownButton } from '@/components/catalyst/dropdown'

interface ClientAvatarButtonProps {
  src?: string | null
  initials?: string
  alt?: string
  className?: string
}

export default function ClientAvatarButton({ 
  src = '/default-avatar.png', 
  initials, 
  alt = 'Account options',
  className = 'size-8'
}: ClientAvatarButtonProps) {
  return (
    <DropdownButton aria-label={alt} plain>
      <AvatarButton 
        src={src || '/default-avatar.png'} 
        initials={initials}
        alt={alt}
        className={className}
      />
    </DropdownButton>
  )
}
