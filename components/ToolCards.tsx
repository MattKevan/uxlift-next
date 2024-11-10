'use client'

import { CldImage } from 'next-cloudinary'
import type { Database } from '@/types/supabase'

type Tool = Database['public']['Tables']['content_tool']['Row']

interface ToolCardProps {
  tool: Tool
}

export function ToolCard({ tool }: ToolCardProps) {
  return (

    <a
      href={tool.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block transition-all duration-200 p-4 hover:bg-gray-50 hover:dark:bg-gray-900 h-full border-b sm:border-r"
    >
     
      <div className='flex flex-row gap-4'>
        <div className='flex-1'>
        <h3 className="font-bold mb-2 text-lg tracking-tight">
      {tool.title}
      </h3><p className="line-clamp-3 text-gray-500">
        {tool.description}
      </p></div>
      
      <CldImage
          src={tool.image}
          alt={tool.title}
          width={70}
          height={70}
          className="w-[70px] h-[70px] flex-none rounded"
        />
      </div>
  
    </a>
  )
}
