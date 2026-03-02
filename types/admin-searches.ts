export interface SavedSearchResult {
  post_id: number
  title: string
  link: string
  similarity: number
  excerpt: string
}

export interface SavedSearchPayload {
  answer: string | null
  results: SavedSearchResult[]
  error: string | null
}

export interface AdminSearchItem {
  id: number
  createdAt: string
  query: string
  summary: string | null
  totalResults: number | null
  userId: string | null
  userEmail: string | null
  resultPayload: SavedSearchPayload | null
}

export interface AdminSearchesResponse {
  searches: AdminSearchItem[]
  total: number
  page: number
  perPage: number
}
