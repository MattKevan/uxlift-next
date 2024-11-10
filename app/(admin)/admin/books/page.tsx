// /app/(admin)/admin/books/page.tsx
'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { Database } from '@/types/supabase'
import EditBookModal from '@/components/EditBookModal'
import { BookCard } from '@/components/BookCards'

type Book = Database['public']['Tables']['content_book']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type BookWithRelations = Book & {
  content_book_topics: {
    topic: Topic
  }[]
}

const BOOKS_PER_PAGE = 50

export default function AdminBooks() {
  const [books, setBooks] = useState<BookWithRelations[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = createClient()
  const [selectedBook, setSelectedBook] = useState<BookWithRelations | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchBooks = async () => {
    const { data: booksData, count: totalCount } = await supabase
      .from('content_book')
      .select(`
        *,
        content_book_topics (
          topic:topic_id (
            id,
            name,
            slug
          )
        )
      `, { count: 'exact' })
      .order('title', { ascending: true })
      .range((currentPage - 1) * BOOKS_PER_PAGE, currentPage * BOOKS_PER_PAGE - 1)

    if (booksData) {
      setBooks(booksData as BookWithRelations[])
    }
    if (totalCount !== null) {
      setCount(totalCount)
    }
  }

  useEffect(() => {
    fetchBooks()
  }, [currentPage])

  const handleEdit = (book: BookWithRelations) => {
    setSelectedBook(book)
    setIsModalOpen(true)
  }

  const handleUpdate = (updatedBook: BookWithRelations) => {
    setBooks(books.map(book => 
      book.id === updatedBook.id ? updatedBook : book
    ))
  }

  const totalPages = Math.ceil(count / BOOKS_PER_PAGE)

  return (
    <div className="">
      <h1 className="text-2xl font-bold mb-6">Manage Books</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-sans">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Publisher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Free</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>

            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {books.map((book) => (
              <tr key={book.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    {book.image_path && (
                      <img 
                        src={book.image_path} 
                        alt={book.title}
                        className="h-12 w-9 object-cover"
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium dark:text-white">{book.title}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                        {book.description}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">{book.authors}</td>
                <td className="px-6 py-4">{book.publisher}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {book.content_book_topics.map(({ topic }) => (
                      <span 
                        key={topic.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {topic.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    book.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {book.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    book.free ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {book.free ? 'Free' : 'Paid'}
                  </span>
                </td>
                <td className="px-6 py-4">
                <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {book.body ? `${book.body.substring(0, 100)}...` : 'No content'}
                </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleEdit(book)}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Edit
                  </button>
                </td>
                
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {((currentPage - 1) * BOOKS_PER_PAGE) + 1} to {Math.min(currentPage * BOOKS_PER_PAGE, count)} of {count} results
        </div>
        <div className="flex space-x-2">
          {currentPage > 1 && (
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-3 py-2 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Previous
            </button>
          )}
          {currentPage < totalPages && (
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-3 py-2 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Next
            </button>
          )}
        </div>
      </div>

      {selectedBook && (
        <EditBookModal
          book={selectedBook}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedBook(null)
          }}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
