// /utils/post-tools/embed-post.ts
import { OpenAI } from 'openai'
import type { Database, Json } from '@/types/supabase'
import { createClient } from '@supabase/supabase-js'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import sanitizeHtml from 'sanitize-html'

type Post = Database['public']['Tables']['content_post']['Row']
type SupabaseClient = ReturnType<typeof createClient<Database>>

interface EmbedPostResult {
  success: boolean;
  chunks?: number;
  error?: string;
  details?: string;
}

type DocumentMetadata = {
  [key: string]: Json | undefined;
} & {
  post_id: number;
  title: string;
  link: string;
  chunk_index: number;
  total_chunks: number;
}

interface ContentStats {
  originalLength: number;
  cleanedLength: number;
  htmlTagsRemoved: number;
  entitiesReplaced: number;
}

interface ChunkConfig {
  size: number;
  overlap: number;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

function cleanHTML(html: string): string {
  try {
    // First pass: Remove HTML while keeping structure
    const cleaned = sanitizeHtml(html, {
      allowedTags: [], // Remove all HTML tags
      allowedAttributes: {},
      textFilter: function(text) {
        return text
          .replace(/\s+/g, ' ') // Replace multiple spaces
          .replace(/\n\s*\n/g, '\n\n') // Clean up newlines
          .trim()
      },
      nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe'],
    })

    // Second pass: Clean up entities and special characters
    return cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/\s+/g, ' ')
      .trim()

  } catch (error) {
    console.error('Error cleaning HTML:', error)
    return html
  }
}

function getContentStats(original: string, cleaned: string): ContentStats {
  const htmlTagCount = (original.match(/<[^>]*>/g) || []).length

  return {
    originalLength: original.length,
    cleanedLength: cleaned.length,
    htmlTagsRemoved: htmlTagCount,
    entitiesReplaced: (original.match(/&[a-zA-Z0-9#]+;/g) || []).length
  }
}

function getChunkConfig(contentLength: number): ChunkConfig {
  if (contentLength < 5000) {
    return { size: 1000, overlap: 200 };      // Short content
  } else if (contentLength < 20000) {
    return { size: 2000, overlap: 400 };      // Medium content
  } else {
    return { size: 4000, overlap: 800 };      // Long content
  }
}

export async function embedPost(postId: number, supabase: SupabaseClient): Promise<EmbedPostResult> {
  try {
    // Check for existing embeddings first
    const { count: existingCount, error: checkError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->post_id', postId);

    if (checkError) {
      console.error(`Error checking existing embeddings for post ${postId}:`, checkError);
      return {
        success: false,
        error: 'Failed to check existing embeddings',
        details: checkError.message
      };
    }

    // If embeddings exist, delete them
    if (existingCount && existingCount > 0) {
      console.log(`Removing ${existingCount} existing embeddings for post ${postId}`);
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('metadata->post_id', postId);

      if (deleteError) {
        console.error('Error deleting existing embeddings:', deleteError);
        return {
          success: false,
          error: 'Failed to remove existing embeddings',
          details: deleteError.message
        };
      }
    }

    // Fetch the post content
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('content, title, description, link')
      .eq('id', postId)
      .single();

    if (fetchError) {
      console.error('Error fetching post:', fetchError);
      return {
        success: false,
        error: 'Failed to fetch post',
        details: fetchError.message
      };
    }

    if (!post) {
      return {
        success: false,
        error: 'Post not found'
      };
    }

    // Clean the content
    const cleanContent = post.content ? cleanHTML(post.content) : ''
    const cleanDescription = post.description ? cleanHTML(post.description) : ''

    // Log cleaning stats
    if (post.content) {
      const stats = getContentStats(post.content, cleanContent)
      console.log(`Content cleaning stats for post ${postId}:`, stats)
    }

    // Verify post has content
    if (!cleanContent && !cleanDescription) {
      return {
        success: false,
        error: 'Post has no content or description to embed after cleaning'
      };
    }

    // Create content string for embedding with cleaned content
    const contentToEmbed = [
      post.title && `Title: ${post.title}`,
      cleanDescription && `Description: ${cleanDescription}`,
      cleanContent && `Content: ${cleanContent}`
    ].filter(Boolean).join('\n\n');

    // Get chunk configuration based on content length
    const chunkConfig = getChunkConfig(contentToEmbed.length);

    // Initialize text splitter with dynamic chunk size
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkConfig.size,
      chunkOverlap: chunkConfig.overlap,
    });

    // Split text into chunks
    const chunks = await textSplitter.createDocuments([contentToEmbed]);

    console.log(`Processing post ${postId} with chunk size ${chunkConfig.size} and ${chunks.length} chunks`);

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Generate embedding
        const embedding = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk.pageContent,
        });

        const metadata: DocumentMetadata = {
          post_id: postId,
          title: post.title || '',
          link: post.link || '',
          chunk_index: i,
          total_chunks: chunks.length
        };

        const documentInsert: Database['public']['Tables']['documents']['Insert'] = {
          content: chunk.pageContent,
          embedding: JSON.stringify(embedding.data[0].embedding),
          metadata: metadata
        };

        // Store in documents table
        const { error: insertError } = await supabase
          .from('documents')
          .insert(documentInsert);

        if (insertError) {
          // If insertion fails, cleanup any successfully inserted chunks
          await supabase
            .from('documents')
            .delete()
            .eq('metadata->post_id', postId);

          console.error('Error inserting embedding:', insertError);
          return {
            success: false,
            error: 'Failed to insert embedding',
            details: insertError.message
          };
        }
      } catch (error) {
        // If OpenAI API fails, cleanup any successfully inserted chunks
        await supabase
          .from('documents')
          .delete()
          .eq('metadata->post_id', postId);

        console.error('OpenAI API error:', error);
        return {
          success: false,
          error: 'OpenAI API error',
          details: error instanceof Error ? error.message : 'Unknown OpenAI error'
        };
      }
    }

    // Only update indexed status if all chunks were successfully processed
    const { error: updateError } = await supabase
      .from('content_post')
      .update({ indexed: true })
      .eq('id', postId);

    if (updateError) {
      console.error('Error updating post indexed status:', updateError);
      return {
        success: false,
        error: 'Failed to update post indexed status',
        details: updateError.message
      };
    }

    console.log(`Successfully embedded post ${postId} in ${chunks.length} chunks`);
    return {
      success: true,
      chunks: chunks.length
    };

  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
