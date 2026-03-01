// /app/(admin)/admin/posts/page.tsx

'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import EditPostModal from '@/components/EditPostModal'
import type { Database } from '@/types/supabase'
import FetchUrlForm from '@/components/FetchUrlForm'

type Post = Database['public']['Tables']['content_post']['Row']
type Site = Database['public']['Tables']['content_site']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type PostWithRelations = Post & {
  content_site: Site | null
  content_post_topics: {
    content_topic: Topic
  }[]
}

interface EmbedProgressUpdate {
  type: 'progress'
  total: number
  processed: number
  succeeded: number
  failed: number
  currentPost?: {
    id: number
    title?: string
  }
}

interface EmbedErrorUpdate {
  type: 'error'
  postId: number
  error: string
  details?: string
}

interface EmbedCompletionUpdate {
  type: 'complete'
  total: number
  succeeded: number
  failed: number
  errors: EmbedErrorUpdate[]
}

type EmbedStreamUpdate = EmbedProgressUpdate | EmbedErrorUpdate | EmbedCompletionUpdate

const POSTS_PER_PAGE = 50

// Helper function to call the GitHub Actions trigger API
const triggerGitHubAction = async (processType: 'feeds' | 'embed' | 'both') => {
  const response = await fetch('/api/trigger-github-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ process_type: processType })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detailSuffix = errorData.details ? ` Details: ${errorData.details}` : '';
    throw new Error((errorData.error || 'Failed to trigger GitHub workflow') + detailSuffix);
  }
  
  return response.json();
};

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
    processType: null as 'tagging' | 'embedding' | null
  });
  const [batchErrors, setBatchErrors] = useState<Array<{
    postId: number;
    error: string;
    details?: string;
  }>>([])
  const [showErrors, setShowErrors] = useState(false)
  const [embedding, setEmbedding] = useState<number | null>(null);
  const [batchEmbedding, setBatchEmbedding] = useState(false);
  const [embeddingUnindexed, setEmbeddingUnindexed] = useState(false);
  
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
 
  const handleResetIndexStatus = async () => {
    if (!confirm('Are you sure you want to reset the index status for all posts? This will mark all posts as unindexed.')) {
      return;
    }
  
    try {
      // Reset index status directly via Supabase
      const { error } = await supabase
        .from('content_post')
        .update({ indexed: false })
        .neq('id', 0); // Update all posts
      
      if (error) {
        throw new Error(`Failed to reset index status: ${error.message}`);
      }
      
      alert('Successfully reset index status for all posts');
      await fetchPosts();
    } catch (error) {
      console.error('Error resetting index status:', error);
      alert(error instanceof Error ? error.message : 'Failed to reset index status');
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
      // Reset indexed status for all posts via Supabase
      const { error: updateError } = await supabase
        .from('content_post')
        .update({ indexed: false })
        .neq('id', 0);
      
      if (updateError) {
        throw new Error(`Failed to reset post index status: ${updateError.message}`);
      }
      
      alert('All posts have been reset to unindexed. You may need to manually delete embeddings from Pinecone.');
      await fetchPosts();
    } catch (error) {
      console.error('Error resetting embeddings:', error);
      alert(error instanceof Error ? error.message : 'Failed to reset embeddings');
    }
  };
  
  const handleEmbed = async (postId: number) => {
    try {
      setEmbedding(postId);
      
      // Use GitHub Actions to embed posts
      const result = await triggerGitHubAction('embed');
      
      // Create a more optimistic UX - update UI right away
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId
            ? { ...post, indexed: true }
            : post
        )
      );
      
      alert(`Embedding job initiated! Job ID: ${result.jobId}`);
      setProcessingJobId(result.jobId);
      
      // Start polling for job status
      const pollInterval = setInterval(async () => {
        const { data: job } = await supabase
          .from('feed_processing_jobs')
          .select('*')
          .eq('id', result.jobId)
          .single();
  
        if (job && (job.status === 'completed' || job.status === 'failed')) {
          clearInterval(pollInterval);
          
          if (job.status === 'completed') {
            alert(`Embedding job completed successfully!`);
            await fetchPosts(); // Refresh the posts to get updated status
          } else {
            alert(`Embedding job failed: ${job.error || 'Unknown error'}`);
          }
        }
      }, 5000); // Poll every 5 seconds
      
      // Clear interval after 15 minutes to prevent infinite polling
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 15 * 60 * 1000);
  
    } catch (error) {
      console.error('Error embedding post:', error);
      alert(error instanceof Error ? error.message : 'Failed to embed post');
    } finally {
      setEmbedding(null);
    }
  };

  const handleBatchEmbed = async () => {
    if (!confirm('This will re-embed all posts in the database. This process may take several hours using GitHub Actions. Continue?')) {
      return;
    }
  
    try {
      setBatchEmbedding(true);
      
      // Trigger GitHub Action for embedding
      const result = await triggerGitHubAction('embed');
      
      alert(`Embedding job initiated! Job ID: ${result.jobId}. This process will run in the background and may take several hours. You can check the status in the Activity Logs.`);
      
      setProcessingJobId(result.jobId);
      
    } catch (error) {
      console.error('Error initiating batch embedding:', error);
      alert(error instanceof Error ? error.message : 'Failed to start embedding process');
    } finally {
      setBatchEmbedding(false);
    }
  };

  const handleEmbedUnindexed = async () => {
    if (!confirm('Embed only posts that are currently marked as not embedded?')) {
      return
    }

    let completed = false

    try {
      setEmbeddingUnindexed(true)
      setShowErrors(false)
      setBatchErrors([])
      setBatchProgress({
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        currentPost: null,
        processType: 'embedding',
      })

      const response = await fetch('/api/embed-all-posts', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error || 'Failed to start embedding unindexed posts')
      }

      if (!response.body) {
        throw new Error('Embedding stream did not return a response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const line = event
            .split('\n')
            .find((candidate) => candidate.startsWith('data: '))

          if (!line) continue

          const rawPayload = line.slice(6).trim()
          if (!rawPayload) continue

          let payload: EmbedStreamUpdate
          try {
            payload = JSON.parse(rawPayload) as EmbedStreamUpdate
          } catch {
            continue
          }

          if (payload.type === 'progress') {
            setBatchProgress({
              total: payload.total,
              processed: payload.processed,
              succeeded: payload.succeeded,
              failed: payload.failed,
              currentPost: payload.currentPost || null,
              processType: 'embedding',
            })
            continue
          }

          if (payload.type === 'error') {
            if (payload.postId === 0) {
              throw new Error(payload.details ? `${payload.error}: ${payload.details}` : payload.error)
            }

            const errorPayload = {
              postId: payload.postId,
              error: payload.error,
              details: payload.details,
            }
            setBatchErrors((current) => [...current, errorPayload])
            continue
          }

          if (payload.type === 'complete') {
            completed = true
            setBatchProgress({
              total: payload.total,
              processed: payload.total,
              succeeded: payload.succeeded,
              failed: payload.failed,
              currentPost: null,
              processType: 'embedding',
            })
            setBatchErrors(payload.errors || [])
            await fetchPosts()
            alert(`Embedding complete. ${payload.succeeded} succeeded, ${payload.failed} failed.`)
          }
        }
      }
    } catch (error) {
      console.error('Error embedding unindexed posts:', error)
      alert(error instanceof Error ? error.message : 'Failed to embed unindexed posts')
    } finally {
      setEmbeddingUnindexed(false)
      if (!completed) {
        await fetchPosts()
      }
    }
  }

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
      setRefreshing(true);
      
      // Trigger GitHub Action for feed processing
      const result = await triggerGitHubAction('feeds');
      
      alert(`Feed processing initiated! Job ID: ${result.jobId}. You can check the status in the Activity Logs.`);
      
      setProcessingJobId(result.jobId);
      
      // Start polling for job status
      const pollInterval = setInterval(async () => {
        const { data: job } = await supabase
          .from('feed_processing_jobs')
          .select('*')
          .eq('id', result.jobId)
          .single();
  
        if (job) {
          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setRefreshing(false);
            alert(`Feeds refreshed successfully! Processed ${job.processed_items} items with ${job.error_count} errors.`);
            await fetchPosts();
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setRefreshing(false);
            alert(`Feed processing failed: ${job.error}`);
          }
        }
      }, 30000); // Poll every 30 seconds (longer interval since GitHub Actions will take time)
  
      // Clear interval after 30 minutes to prevent infinite polling
      setTimeout(() => {
        clearInterval(pollInterval);
        if (setRefreshing) {
          setRefreshing(false);
        }
      }, 30 * 60 * 1000);
  
    } catch (error) {
      console.error('Error refreshing feeds:', error);
      setRefreshing(false);
      alert(error instanceof Error ? error.message : 'Failed to refresh feeds');
    }
  };
  
  const handleAutoTag = async (postId: number) => {
    try {
      setTagging(postId);
      
      // Use GitHub Actions to tag posts
      const result = await triggerGitHubAction('both'); // Using 'both' will run tagging as well
      
      alert(`Tagging job initiated! Job ID: ${result.jobId}`);
      
      // Start polling for job status
      const pollInterval = setInterval(async () => {
        const { data: job } = await supabase
          .from('feed_processing_jobs')
          .select('*')
          .eq('id', result.jobId)
          .single();
  
        if (job && (job.status === 'completed' || job.status === 'failed')) {
          clearInterval(pollInterval);
          
          if (job.status === 'completed') {
            alert(`Tagging job completed successfully!`);
            await fetchPosts(); // Refresh the posts to get updated tags
          } else {
            alert(`Tagging job failed: ${job.error || 'Unknown error'}`);
          }
        }
      }, 5000); // Poll every 5 seconds
      
      // Clear interval after 15 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 15 * 60 * 1000);
  
    } catch (error) {
      console.error('Error auto-tagging post:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Failed to auto-tag post');
      }
    } finally {
      setTagging(null);
    }
  };

  const handleSummarise = async (postId: number) => {
    try {
      setSummarising(postId);
      
      // Use GitHub Actions for summarization
      const result = await triggerGitHubAction('both'); // Using 'both' will handle summarization
      
      alert(`Summarization job initiated! Job ID: ${result.jobId}`);
      
      // Start polling for job status
      const pollInterval = setInterval(async () => {
        const { data: job } = await supabase
          .from('feed_processing_jobs')
          .select('*')
          .eq('id', result.jobId)
          .single();
  
        if (job && (job.status === 'completed' || job.status === 'failed')) {
          clearInterval(pollInterval);
          
          if (job.status === 'completed') {
            alert(`Summarization job completed successfully!`);
            await fetchPosts(); // Refresh the posts to get updated summaries
          } else {
            alert(`Summarization job failed: ${job.error || 'Unknown error'}`);
          }
        }
      }, 5000); // Poll every 5 seconds
      
      // Clear interval after 15 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 15 * 60 * 1000);
  
    } catch (error) {
      console.error('Error summarizing post:', error);
      alert(error instanceof Error ? error.message : 'Failed to summarize post');
    } finally {
      setSummarising(null);
    }
  };
  
  const handleBatchTag = async () => {
    if (!confirm('This will re-tag all posts in the database using GitHub Actions. This may take several hours. Continue?')) {
      return;
    }

    try {
      setBatchTagging(true);
      
      // Trigger GitHub Action for tagging
      const result = await triggerGitHubAction('both'); // 'both' includes tagging
      
      alert(`Tagging job initiated! Job ID: ${result.jobId}. This process will run in the background and may take several hours. You can check the status in the Activity Logs.`);
      
      setProcessingJobId(result.jobId);
      
    } catch (error) {
      console.error('Error initiating batch tagging:', error);
      alert(error instanceof Error ? error.message : 'Failed to start tagging process');
    } finally {
      setBatchTagging(false);
    }
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
          {refreshing ? 'Refreshing feeds...' : 'Refresh feeds (GitHub Action)'}
        </button>

        <button
          onClick={handleBatchTag}
          disabled={batchTagging}
          className={`px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors
            ${batchTagging ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {batchTagging ? 'Processing all posts...' : 'Re-tag all posts (GitHub Action)'}
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
            ? `Initializing embedding...`
            : 'Re-embed all posts (GitHub Action)'}
        </button>
        <button
          onClick={handleEmbedUnindexed}
          disabled={embeddingUnindexed || batchEmbedding || batchTagging}
          className={`px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors
            ${(embeddingUnindexed || batchEmbedding || batchTagging) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {embeddingUnindexed
            ? `Embedding ${batchProgress.processed}/${batchProgress.total || '?'}...`
            : 'Embed Unindexed Posts'}
        </button>
        <button
          onClick={handleResetAllEmbeddings}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Reset All Embeddings
        </button>
      </div>

      {embeddingUnindexed && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
          <h3 className="font-medium">Embedding Unindexed Posts</h3>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Processed {batchProgress.processed} of {batchProgress.total || '...'}.
            {' '}Succeeded: {batchProgress.succeeded}, Failed: {batchProgress.failed}.
          </p>
          {batchProgress.currentPost && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Current post: #{batchProgress.currentPost.id}
              {batchProgress.currentPost.title ? ` - ${batchProgress.currentPost.title}` : ''}
            </p>
          )}
          {batchErrors.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowErrors((current) => !current)}
                className="text-sm font-medium text-red-700 hover:underline dark:text-red-300"
              >
                {showErrors ? 'Hide errors' : `Show errors (${batchErrors.length})`}
              </button>
              {showErrors && (
                <ul className="mt-2 max-h-40 overflow-auto rounded bg-white p-2 text-sm dark:bg-gray-900">
                  {batchErrors.slice(0, 100).map((item, index) => (
                    <li key={`${item.postId}-${index}`} className="py-1 text-red-700 dark:text-red-300">
                      #{item.postId}: {item.error}
                      {item.details ? ` (${item.details})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {processingJobId && (
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Background Job Running</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Job ID: {processingJobId} - This job is processing in GitHub Actions and may take time to complete.
              </p>
            </div>
            <a 
              href="/admin/activity-logs" 
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              View in Activity Logs →
            </a>
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
                    {summarising === post.id ? 'Summarising...' : 'Summarise (GH)'}
                  </button>
                  <button
                    onClick={() => handleAutoTag(post.id)}
                    disabled={tagging === post.id}
                    className={`text-purple-600 hover:underline dark:text-purple-400 ${
                      tagging === post.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {tagging === post.id ? 'Tagging...' : 'Auto-tag (GH)'}
                  </button>
                  <button
                    onClick={() => handleEmbed(post.id)}
                    disabled={embedding === post.id}
                    className={`text-green-600 hover:underline dark:text-green-400 ${
                      embedding === post.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {embedding === post.id ? 'Embedding...' : 'Embed (GH)'}
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
