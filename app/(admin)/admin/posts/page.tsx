// /app/(admin)/admin/posts/page.tsx

'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import EditPostModal from '@/components/EditPostModal'
import type { Database } from '@/types/supabase'
import FetchUrlForm from '@/components/FetchUrlForm'
import { summarisePost } from '@/utils/post-tools/summarise'

type Post = Database['public']['Tables']['content_post']['Row']
type Site = Database['public']['Tables']['content_site']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type PostWithRelations = Post & {
  content_site: Site | null
  content_post_topics: {
    content_topic: Topic
  }[]
}

const POSTS_PER_PAGE = 50

export default function AdminPosts() {
  const [posts, setPosts] = useState<PostWithRelations[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPost, setSelectedPost] = useState<PostWithRelations | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const supabase = createClient()
  const [summarising, setSummarising] = useState<number | null>(null)
  const [tagging, setTagging] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [batchTagging, setBatchTagging] = useState(false)
  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    currentPost: null as { id: number; title?: string } | null,
    processType: null as 'tagging' | 'embedding' | null // Add this
  });
  const [batchErrors, setBatchErrors] = useState<Array<{
    postId: number;
    error: string;
    details?: string;
  }>>([])
  const [showErrors, setShowErrors] = useState(false)
  const [embedding, setEmbedding] = useState<number | null>(null);
  const [batchEmbedding, setBatchEmbedding] = useState(false);
 
 
  const handleResetIndexStatus = async () => {
    if (!confirm('Are you sure you want to reset the index status for all posts? This will mark all posts as unindexed.')) {
      return;
    }
  
    try {
      const response = await fetch('/api/reset-index-status', {
        method: 'POST',
      });
  
      if (!response.ok) {
        throw new Error('Failed to reset index status');
      }
  
      alert('Successfully reset index status for all posts');
    } catch (error) {
      console.error('Error resetting index status:', error);
      alert('Failed to reset index status');
    }
  };

  const handleResetAllEmbeddings = async () => {
    if (!confirm('WARNING: This will delete ALL embeddings and reset ALL posts to unindexed. Are you sure?')) {
      return;
    }
  
    if (!confirm('This action cannot be undone. Are you really sure?')) {
      return;
    }
  
    try {
      const response = await fetch('/api/reset-embeddings', {
        method: 'POST',
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset embeddings');
      }
  
      alert(`Success! Deleted ${data.deletedCount} embeddings. All posts have been reset to unindexed.`);
      // Refresh your UI as needed
      
    } catch (error) {
      console.error('Error resetting embeddings:', error);
      alert(error instanceof Error ? error.message : 'Failed to reset embeddings');
    }
  };
  
  const handleEmbed = async (postId: number) => {
    try {
      setEmbedding(postId);
      
      const response = await fetch('/api/embed-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId }),
      });
  
      const result = await response.json();
  
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to embed post');
      }
  
      if (result.success) {
        // Update the post in the UI to show it's been indexed
        setPosts(currentPosts => 
          currentPosts.map(post => 
            post.id === postId 
              ? { ...post, indexed: true } 
              : post
          )
        );
        alert(`Post successfully embedded with ${result.chunks} chunks`);
      }
  
    } catch (error) {
      console.error('Error embedding post:', error);
      alert(error instanceof Error ? error.message : 'Failed to embed post');
    } finally {
      setEmbedding(null);
    }
  };


  const handleBatchEmbed = async () => {
    if (!confirm('This will re-embed all posts in the database. This process may take several hours. Continue?')) {
      return;
    }
  
    try {
      setBatchEmbedding(true);
      setBatchErrors([]);
      setBatchProgress({
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        currentPost: null,
        processType: 'embedding'
      });
      
      const response = await fetch('/api/embed-all-posts', {
        method: 'POST',
      });
  
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
  
      if (!reader) {
        throw new Error('Failed to initialize stream reader');
      }
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
  
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
  
            switch (data.type) {
              case 'progress':
                setBatchProgress(prev => ({
                  ...prev,
                  total: data.total,
                  processed: data.processed,
                  succeeded: data.succeeded,
                  failed: data.failed,
                  currentPost: data.currentPost,
                  processType: 'embedding'
                }));
                break;
  
              case 'error':
                setBatchErrors(prev => [...prev, {
                  postId: data.postId,
                  error: data.error,
                  details: data.details
                }]);
                break;
  
              case 'complete':
                alert(`Embedding complete!\nProcessed: ${data.total}\nSucceeded: ${data.succeeded}\nFailed: ${data.failed}`);
                await fetchPosts();
                break;
            }
          }
        }
      }
  
    } catch (error) {
      console.error('Error batch embedding posts:', error);
      alert(error instanceof Error ? error.message : 'Failed to process posts');
    } finally {
      setBatchEmbedding(false);
      setBatchProgress(prev => ({
        ...prev,
        processType: null
      }));
    }
  };

  const fetchPosts = async () => {
    const { data: postsData, count: totalCount } = await supabase
      .from('content_post')
      .select(`
        *,
        content_site (
          title,
          url
        ),
        content_post_topics (
          content_topic (
            id,
            name,
            slug
          )
        )
      `, { count: 'exact' })
      .order('date_published', { ascending: false, nullsFirst: false }) // Updated ordering
      .range((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE - 1)

    if (postsData) {
      setPosts(postsData as PostWithRelations[])
    }
    if (totalCount !== null) {
      setCount(totalCount)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [currentPage])

  const handleEdit = (post: PostWithRelations) => {
    setSelectedPost(post)
    setIsModalOpen(true)
  }

  const handleUpdate = (updatedPost: PostWithRelations) => {
    setPosts(posts.map(post => 
      post.id === updatedPost.id ? { ...post, ...updatedPost } : post
    ))
  }
  const handleDelete = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return
    }
  
    try {
      // First delete related records in content_post_topics
      const { error: topicsError } = await supabase
        .from('content_post_topics')
        .delete()
        .eq('post_id', postId)
  
      if (topicsError) {
        throw new Error('Failed to delete post topics')
      }
  
      // Then delete the post itself
      const { error: postError } = await supabase
        .from('content_post')
        .delete()
        .eq('id', postId)
  
      if (postError) {
        throw new Error('Failed to delete post')
      }
  
      // Update the UI by removing the deleted post
      setPosts(currentPosts => 
        currentPosts.filter(post => post.id !== postId)
      )
  
      // Update the total count
      setCount(prevCount => prevCount - 1)
  
    } catch (error) {
      console.error('Error deleting post:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete post')
    }
  }
  
  const formatPublishedDate = (dateString: string | null) => {
    if (!dateString) return 'Not published'
    return format(parseISO(dateString), 'dd/MM/yyyy')
  }

  const handleRefreshFeeds = async () => {
    try {
      setRefreshing(true)
  
      const response = await fetch('/api/process-feeds', {
        method: 'GET',
        credentials: 'include',
      })
  
      const result = await response.json()
  
      if (!response.ok) {
        throw new Error(result.error || 'Failed to start feed processing')
      }
  
      // Start polling for job status
      const jobId = result.jobId
      const pollInterval = setInterval(async () => {
        const { data: job } = await supabase
          .from('feed_processing_jobs')
          .select('*')
          .eq('id', jobId)
          .single()
  
        if (job) {
          if (job.status === 'completed') {
            clearInterval(pollInterval)
            setRefreshing(false)
            alert(`Feeds refreshed successfully! Processed ${job.processed_items} items with ${job.error_count} errors.`)
            await fetchPosts()
          } else if (job.status === 'failed') {
            clearInterval(pollInterval)
            setRefreshing(false)
            alert(`Feed processing failed: ${job.error}`)
          } else {
            // Update progress UI
            console.log(`Processing: ${job.processed_sites}/${job.total_sites} sites`)
          }
        }
      }, 2000) // Poll every 2 seconds
  
      // Clear interval after 10 minutes to prevent infinite polling
      setTimeout(() => {
        clearInterval(pollInterval)
        setRefreshing(false)
      }, 600000)
  
    } catch (error) {
      console.error('Error refreshing feeds:', error)
      setRefreshing(false)
      alert(error instanceof Error ? error.message : 'Failed to refresh feeds')
    }
  }
  
const handleAutoTag = async (postId: number) => {
    try {
      setTagging(postId)
      
      const response = await fetch('/api/tag-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId }),
      })
  
      const result = await response.json()
  
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to auto-tag post')
      }
  
      if (result.success && result.post) {
        setPosts(currentPosts => 
          currentPosts.map(post => 
            post.id === result.post.id ? result.post : post
          )
        )
  
        if (result.suggestedTopics) {
          alert('Post successfully tagged with topics: ' + result.suggestedTopics.join(', '))
        }
      }
  
    } catch (error) {
      console.error('Error auto-tagging post:', error)
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('Failed to auto-tag post')
      }
    } finally {
      setTagging(null)
    }
  }

  const handleSummarise = async (postId: number) => {
    try {
      setSummarising(postId)
      
      const response = await fetch('/api/summarise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId }),
      })
  
      const result = await response.json()
  
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to summarize post')
      }
  
      if (result.success && result.summary) {
        setPosts(currentPosts => 
          currentPosts.map(post => 
            post.id === postId 
              ? { ...post, summary: result.summary } 
              : post
          )
        )
        alert('Summary generated successfully')
      }
  
    } catch (error) {
      console.error('Error summarizing post:', error)
      alert(error instanceof Error ? error.message : 'Failed to summarize post')
    } finally {
      setSummarising(null)
    }
  }
  const handleBatchTag = async () => {
    if (!confirm('This will re-tag all posts in the database. This may take several minutes. Continue?')) {
      return;
    }

    try {
      setBatchTagging(true);
      setBatchErrors([]);
      setBatchProgress({
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        currentPost: null,
        processType: 'tagging'
      });
      
      const response = await fetch('/api/tag-all-posts', {
        method: 'POST',
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to initialize stream reader');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'progress':
            setBatchProgress({
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  currentPost: null,
  processType: 'tagging'
});
                break;

              case 'error':
                setBatchErrors(prev => [...prev, {
                  postId: data.postId,
                  error: data.error,
                  details: data.details
                }]);
                break;

              case 'complete':
                await fetchPosts();
                break;
            }
          }
        }
      }

    } catch (error) {
      console.error('Error batch tagging posts:', error);
      alert(error instanceof Error ? error.message : 'Failed to process posts');
    } finally {
      setBatchTagging(false);
      setBatchProgress(prev => ({
        ...prev,
        processType: null
      }));    }
  };

  const totalPages = Math.ceil(count / POSTS_PER_PAGE)
  const handlePostCreated = (newPost: PostWithRelations) => {
    // Update your posts list or show a success message
    setPosts([newPost, ...posts])
  }
  return (
    <div className="">
      <h1 className="text-2xl font-bold mb-6">Manage posts</h1>
      
      <div className="flex space-x-4 mb-6">
        <button
          onClick={handleRefreshFeeds}
          disabled={refreshing}
          className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors
            ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {refreshing ? 'Refreshing feeds...' : 'Refresh feeds'}
        </button>

        <button
          onClick={handleBatchTag}
          disabled={batchTagging}
          className={`px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors
            ${batchTagging ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {batchTagging ? 'Processing all posts...' : 'Re-tag all posts'}
        </button>
        <button
  onClick={handleResetIndexStatus}
  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
>
  Reset All Index Status
</button>
        <button
  onClick={handleBatchEmbed}
  disabled={batchEmbedding || batchTagging}
  className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors
    ${(batchEmbedding || batchTagging) ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  {batchEmbedding 
    ? `Embedding: ${batchProgress.processed}/${batchProgress.total}`
    : 'Re-embed all posts'}
</button>
<button
  onClick={handleResetAllEmbeddings}
  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
>
  Reset All Embeddings
</button>
      </div>

      {(batchTagging || batchEmbedding) && (
  <div className="mb-8 space-y-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
      <div 
        className={`h-2.5 rounded-full transition-all duration-500 ${
          batchTagging ? 'bg-purple-600' : 'bg-green-600'
        }`}
        style={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
      ></div>
    </div>
    
    <div className="text-sm text-gray-600 dark:text-gray-300">
      <div className="flex justify-between">
        <span>
          {batchTagging ? 'Tagging' : 'Embedding'}: {batchProgress.processed} / {batchProgress.total} posts
        </span>
        <span>
          Success: <span className="text-green-600">{batchProgress.succeeded}</span> | 
          Failed: <span className="text-red-600">{batchProgress.failed}</span>
        </span>
      </div>
      {batchProgress.currentPost && (
        <div className="text-xs text-gray-500 mt-1">
          Current: {batchProgress.currentPost.title || `Post ${batchProgress.currentPost.id}`}
        </div>
      )}
    </div>

    {batchErrors.length > 0 && (
      <div className="mt-4">
        <button
          onClick={() => setShowErrors(!showErrors)}
          className="text-red-600 text-sm hover:underline"
        >
          {showErrors ? 'Hide' : 'Show'} Errors ({batchErrors.length})
        </button>
        
        {showErrors && (
          <div className="mt-2 max-h-40 overflow-y-auto text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded">
            {batchErrors.map((error, index) => (
              <div key={index} className="mb-2 text-red-600 dark:text-red-400">
                <div>Post ID: {error.postId}</div>
                <div>Error: {error.error}</div>
                {error.details && <div>Details: {error.details}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    
    <div className="mt-4 text-xs text-gray-500">
      <div>Processing {batchTagging ? 'tags' : 'embeddings'} in batches to avoid rate limits.</div>
      <div>This may take several minutes to complete.</div>
    </div>
  </div>
)}
      <FetchUrlForm onSuccess={handlePostCreated} />

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-sans">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Embedded</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Published</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium dark:text-white">{post.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {post.description}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  {post.summary && (
                    post.summary
                  )}
                </td>
                <td className="px-6 py-4">
                  {post.content_site?.title && (
                    <a 
                      href={post.content_site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {post.content_site.title}
                    </a>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {post.content_post_topics.map(({ content_topic }) => (
                      <span 
                        key={content_topic.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {content_topic.name}
                      </span>
                    ))}
                  </div>
                </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      post.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      post.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      post.indexed === true ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      post.indexed === false ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {post.indexed === true ? ('True'):

                      ('False') }
                    </span>
                  </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatPublishedDate(post.date_published)}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleEdit(post)}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Edit
                  </button>
                  <button
          onClick={() => handleSummarise(post.id)}
          disabled={summarising === post.id}
          className={`text-green-600 hover:underline dark:text-green-400 ${
            summarising === post.id ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {summarising === post.id ? 'Summarising...' : 'Summarise'}
        </button>
        <button
          onClick={() => handleAutoTag(post.id)}
          disabled={tagging === post.id}
          className={`text-purple-600 hover:underline dark:text-purple-400 ${
            tagging === post.id ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {tagging === post.id ? 'Tagging...' : 'Auto-tag'}
        </button>
        <button
  onClick={() => handleEmbed(post.id)}
  disabled={embedding === post.id}
  className={`text-green-600 hover:underline dark:text-green-400 ${
    embedding === post.id ? 'opacity-50 cursor-not-allowed' : ''
  }`}
>
  {embedding === post.id ? 'Embedding...' : 'Embed'}
</button>
        <button
    onClick={() => handleDelete(post.id)}
    className="text-red-600 hover:underline dark:text-red-400"
  >
    Delete
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
          Showing {((currentPage - 1) * POSTS_PER_PAGE) + 1} to {Math.min(currentPage * POSTS_PER_PAGE, count)} of {count} results
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

      {selectedPost && (
        <EditPostModal
          post={selectedPost}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedPost(null)
          }}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
