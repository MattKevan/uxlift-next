import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { JSDOM } from 'jsdom'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

function cleanHtml(html: string): string {
  const dom = new JSDOM(html)
  const document = dom.window.document

  // Remove all style attributes
  document.querySelectorAll('*[style]').forEach(element => {
    element.removeAttribute('style')
  })

  // Remove style tags
  document.querySelectorAll('style').forEach(element => {
    element.remove()
  })

  document.querySelectorAll('h1').forEach(element => {
    element.remove()
  })
  document.querySelectorAll('#web-header').forEach(element => {
    element.remove()
  })
  // Remove byline wrapper
  document.querySelectorAll('.bh__byline_wrapper').forEach(element => {
    element.remove()
  })

  return document.body.innerHTML
}


export default async function NewsletterPost({ params }: PageProps) {
  const { slug } = await params
  
  const supabase = await createClient()
  
  const { data: post } = await supabase
    .from('newsletter_posts')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!post) {
    notFound()
  }

  // Get the web content directly from the content object
  const webContent = post.content?.free?.web || ''
  const cleanedContent = webContent ? cleanHtml(webContent) : ''

  return (
    <main className="max-w-5xl  px-4 pt-6">
      {/* Header */}
      <header className="mb-12">
        

        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
        <time dateTime={post.publish_date}>
            {format(parseISO(post.publish_date), 'MMMM d, yyyy')}<br/>
          </time> <span className="text-gray-500">{post.title}</span>
        </h1>

        {post.subtitle && (
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
            {post.subtitle}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          
          {post.authors && post.authors.length > 0 && (
            <div className="flex items-center gap-1">
              <span>By</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {post.authors.join(', ')}
              </span>
            </div>
          )}

        </div>
      </header>

      {/* Content */}
      <article 
        className="prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-bold
          prose-a:text-blue-600 dark:prose-a:text-blue-400
          prose-img:rounded-lg
          prose-hr:border-gray-200 dark:prose-hr:border-gray-800"
      >
        {cleanedContent ? (
          <div dangerouslySetInnerHTML={{ __html: cleanedContent }} />
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>This content is not available.</p>
            <a 
              href={post.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline mt-4 block"
            >
              Read on the original site
            </a>
          </div>
        )}
      </article>      
    </main>
  )
}
