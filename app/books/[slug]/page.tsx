import { cache } from 'react'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import Markdown from 'react-markdown'
import { ExternalLink } from '@mynaui/icons-react'
import { createPublicClient } from '@/utils/supabase/public'
import { getAllBookSlugs } from '@/lib/content/public-queries'
import { Tag } from '@/components/Tags'
import { Button } from '@/components/ui/button'
import { BookCard, type BookWithTopics } from '@/components/BookCards'
import { BookCover } from '@/components/BookCover'

type Topic = { id: number; name: string; slug: string }

type Params = Promise<{ slug: string }>

interface PageProps {
  params: Params
}

// Every book is built at deploy time. Unknown slugs 404 without rendering, which
// keeps the Worker inside the free CPU limit. Add a book, then redeploy.
export const revalidate = false
export const dynamicParams = false

export async function generateStaticParams() {
  return getAllBookSlugs()
}

const getBookData = cache(async (slug: string) => {
  const supabase = createPublicClient()

  const { data: book, error } = await supabase
    .from('content_book')
    .select(`
      *,
      topics:content_book_topics (
        topic:topic_id (
          id,
          name,
          slug
        )
      )
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !book) return null

  return book
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const book = await getBookData(slug)

  if (!book) {
    return { title: 'Book Not Found | UX Lift' }
  }

  const title = `${book.title} by ${book.authors} | UX Lift`

  return {
    title,
    description: book.description,
    alternates: { canonical: `/books/${book.slug}/` },
    openGraph: {
      title,
      description: book.description,
      url: `/books/${book.slug}/`,
      siteName: 'UX Lift',
      type: 'book',
    },
    twitter: {
      card: 'summary',
      title,
      description: book.description,
    },
  }
}

export default async function BookPage({ params }: PageProps) {
  const { slug } = await params
  const book = await getBookData(slug)

  if (!book) return notFound()

  const topics = ((book.topics ?? []) as unknown as { topic: Topic | null }[])
    .map(({ topic }) => topic)
    .filter((topic): topic is Topic => Boolean(topic))
  const topicIds = topics.map((topic) => topic.id)

  let relatedBooks: BookWithTopics[] = []

  if (topicIds.length > 0) {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('content_book')
      .select(`
        *,
        topics:content_book_topics!inner (
          topic:topic_id (
            id,
            name,
            slug
          )
        )
      `)
      .in('content_book_topics.topic_id', topicIds)
      .neq('id', book.id)
      .eq('status', 'published')
      .order('title', { ascending: true })
      .limit(6)

    relatedBooks = (data ?? []) as unknown as BookWithTopics[]
  }

  const longText = book.body?.trim() || book.summary?.trim() || ''

  return (
    <main>
      <div className="px-4 mb-24 sm:mb-32 mt-6">
        <div className="max-w-6xl flex flex-col-reverse gap-6 sm:flex-row sm:justify-between">
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {book.title}
            </h1>

            <p className="text-lg text-gray-500 mb-6">
              {book.authors} · {book.publisher} ·{' '}
              {book.free ? (
                <span className="text-green-600 font-medium">Free</span>
              ) : (
                <span>Paid</span>
              )}
            </p>

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {topics.map((topic) => (
                  <Tag key={topic.id} href={`/topics/${topic.slug}`} text={topic.name} />
                ))}
              </div>
            )}

            <p className="text-xl mb-6 tracking-tight text-gray-500 dark:text-gray-300">
              {book.description}
            </p>

            <Button asChild>
              <Link href={book.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2" />
                {book.free ? 'Read the book' : 'Get the book'}
              </Link>
            </Button>
          </div>

          {book.image_path && (
            <BookCover
              src={book.image_path}
              alt={book.title}
              width={240}
              height={300}
              className="aspect-2/2.5 flex-none rounded self-start"
            />
          )}
        </div>
      </div>

      {longText && (
        <div className="mb-10 sm:mb-18 pt-12 border-t">
          <div className="prose prose-lg dark:prose-invert max-w-6xl px-4">
            <Markdown>{longText}</Markdown>
          </div>
        </div>
      )}

      {relatedBooks.length > 0 && (
        <section className="mt-16">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
            Related books
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {relatedBooks.map((related) => (
              <BookCard key={related.id} book={related} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
