// API response types for better type safety
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  success: false
  error: string
  statusCode: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface SearchResponse {
  results: SearchResult[]
  answer: string
  totalResults: number
}

export interface SearchResult {
  id: number
  content: string
  metadata: {
    post_id: number
    title: string
    link: string
  }
  similarity: number
}

export interface ContentSubmissionRequest {
  url: string
}

export interface ContentSubmissionResponse extends ApiResponse {
  data?: {
    id: number
    title: string
    description: string
    link: string
    status: string
  }
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string  
  'X-RateLimit-Reset': string
  'Retry-After'?: string
}

// Environment variables type safety
export interface RequiredEnvVars {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  OPENAI_API_KEY: string
  PINECONE_API_KEY: string
  PINECONE_INDEX_NAME: string
  BEEHIIV_API_KEY: string
  BEEHIIV_PUBLICATION_ID: string
}

export interface OptionalEnvVars {
  CRON_SECRET?: string
  INTERNAL_SECRET?: string
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?: string
}