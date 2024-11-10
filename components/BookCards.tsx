// /components/BookCards.tsx
'use client'

import { CldImage } from 'next-cloudinary'
import type { Database } from '@/types/supabase'

// Use exact types from the database
type Book = Database['public']['Tables']['content_book']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']

// Define the interface to exactly match what we get from the query
export interface BookWithTopics {
  // Book properties from the database
  id: number
  title: string
  description: string
  authors: string
  publisher: string
  link: string
  image_path: string | null
  date_created: string
  date_published: string | null
  free: boolean
  status: string
  summary: string | null
  body: string | null
  // Topics relationship
  topics: {
    topic: Topic
  }[]
}

interface BookCardProps {
  book: BookWithTopics
}

export function BookCard({ book }: BookCardProps) {
  return (
    <a
      href={book.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block transition-all duration-200 p-4 hover:bg-gray-50 hover:dark:bg-gray-900 h-full border-b sm:border-r"
    >
      <div className='flex flex-row gap-4'>
        <div className='flex-1'>
          <h3 className="font-bold mb-2 text-lg tracking-tight">
            {book.title}
          </h3>
          
          <p className="text-sm text-gray-500 mb-2">
            {book.authors} · {book.publisher}
          </p>
          
          <p className="line-clamp-3 text-gray-500">
            {book.description}
          </p>

          <div className="flex flex-wrap gap-2 my-3">
            {book.topics?.map(({ topic }) => (
              <span 
                key={topic.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs border"
              >
                {topic.name}
              </span>
            ))}
          </div>

          <div className="flex items-center mt-3">
            {book.free ? (
              <span className="text-green-600 text-sm font-medium">Free</span>
            ) : (
              <span className="text-gray-500 text-sm">Paid</span>
            )}
          </div>
        </div>

        {book.image_path && (
          <CldImage
            src={book.image_path}
            alt={book.title}
            width={160}
            height={200}
            className="aspect-2/2.5 flex-none rounded"
          />
        )}
      </div>
    </a>
  )
}
