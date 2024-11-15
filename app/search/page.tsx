// /app/search/page.tsx
'use client'

import { createClient } from '@/utils/supabase/client'
import { PostHorizontal } from '@/components/posts/PostsHorizontalSmall'
import { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { useEffect } from 'react'
import type { Database } from '@/types/supabase'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { Sparkles } from '@mynaui/icons-react'
import { Button } from '@/components/ui/button'

type BasePost = Database['public']['Tables']['content_post']['Row']

type Site = {
    id: number
    title: string | null
    slug: string | null
    url: string | null
    site_icon: string | null
  }
  
  interface PostWithSite extends BasePost {
    site: Site | null
    topics?: {
      id: number
      name: string
      slug: string
    }[]
  }
  

interface SearchResult {
  id: number
  content: string
  metadata: {
    post_id: number
    title: string
    link: string
  }
  similarity: number
}

interface SearchResponse {
    results: SearchResult[];
    summary: string;
  }

  export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PostWithSite[]>([])
  const [summary, setSummary] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setSummary('')
    setError(null)
  }


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) {
      setResults([])
      setSummary('')
      return
    }
  
    setLoading(true)
    setError(null)
  
    try {
      console.log('Searching for:', query)
  
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
  
      if (!response.ok) {
        throw new Error('Search failed')
      }
  
      const data: SearchResponse = await response.json()
      console.log('Search response:', data)
  
      const { results: searchResults, summary } = data
  
      // Get unique post IDs using Array.from instead of spread operator
      const postIds = Array.from(
        new Set(searchResults.map(r => r.metadata.post_id))
      )
      
      // Updated select query to match the topics page structure
      const { data: posts, error: postsError } = await supabase
      .from('content_post')
      .select(`
        id,
        slug,
        title,
        description,
        date_published,
        date_created,
        link,
        image_path,
        content,
        indexed,
        site_id,
        status,
        summary,
        tags_list,
        user_id,
        site:content_site!left ( 
          id,
          title,
          slug,
          url,
          site_icon
        ),
        content_post_topics!left (
          topic:content_topic (
            id,
            name,
            slug
          )
        )
      `)
      .in('id', postIds)
      .eq('status', 'published')

    if (postsError) {
      throw new Error('Failed to fetch post details')
    }

    console.log('Fetched posts:', posts)

    // Updated transformation to handle site data correctly
    const transformedPosts: PostWithSite[] = posts?.map(post => ({
      ...post,
      // Take the first item from the site array if it exists
      site: Array.isArray(post.site) ? post.site[0] || null : post.site,
      topics: post.content_post_topics
        ?.map((topicRef: any) => topicRef.topic)
        .filter(Boolean) || []
    })) || []

    // Sort posts based on search result similarity
    const sortedPosts = transformedPosts.sort((a, b) => {
      const aResult = searchResults.find(r => r.metadata.post_id === a.id)
      const bResult = searchResults.find(r => r.metadata.post_id === b.id)
      return (bResult?.similarity || 0) - (aResult?.similarity || 0)
    })

    setResults(sortedPosts)
    setSummary(summary)

  } catch (err) {
    console.error('Search error:', err)
    setError(err instanceof Error ? err.message : 'An error occurred while searching')
  } finally {
    setLoading(false)
  }
}

  return (
    <main className="min-h-screen">
      <div className='px-4 mb-10 sm:mb-18 mt-6'>
      <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
        Search
         <span className="text-gray-500"> over 5500 articles and get answers to your UX questions with our AI search tool.</span>
        </h1>
        </div>

        <form onSubmit={handleSearch} className="max-w-3xl px-4 pt-12 mb-6">
  <div className="flex gap-2">
  <input
  type="search"
  placeholder="Search articles..."
  value={query}
  onChange={(e) => {
    setQuery(e.target.value)
    if (e.target.value === '') {
      setResults([])
      setSummary('')
      setError(null)
    }
  }}
  className="flex-1 px-4 py-3 text-lg border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>

    <button
      type="submit"
      disabled={loading}
      className={`px-6 py-3 transition-colors bg-black dark:bg-white rounded-lg text-white dark:text-gray-900 hover:bg-gray-700 flex items-center gap-2
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <>  
          <div 
            className="animate-spin size-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full" 
            role="status" 
            aria-label="loading"
          >
            <span className="sr-only">Searching</span>
          </div>
          <span>Searching...</span>
        </>) : (
          'Search'
      )}
    </button>
  </div>
</form>

 

      {error && (
        <div className="px-4 sm:px-6 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-8">
          {error}
        </div>
      )}

      

      {results.length > 0 && (
        <>
          {summary && (
            <>
                  <h2 id="summary" className="text-lg font-bold p-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">Summary</h2>

            <div className="p-4 max-w-5xl mb-12">
             
                <p className="">
                  {summary}
                </p>
              </div>
            </>
          )}

          <h2 className="text-lg font-bold pl-4 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">
            Further reading ({results.length})
          </h2>

          <div className='grid grid-cols-1 md:grid-cols-2'>
            {results.map((post) => (
              <PostHorizontal key={post.id} post={post} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}