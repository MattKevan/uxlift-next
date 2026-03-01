// Application constants and configuration
export const APP_CONFIG = {
  // Pagination
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 100,
  
  // Content limits
  MAX_TITLE_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_SEARCH_QUERY_LENGTH: 500,
  
  // Rate limiting (requests per time window)
  RATE_LIMITS: {
    AUTH: { requests: 5, window: '10m' },
    SEARCH: { requests: 50, window: '1h' },
    SUBMIT_CONTENT: { requests: 10, window: '1h' },
    API_GENERAL: { requests: 100, window: '1h' },
  },
  
  // Cache TTL (in milliseconds)
  CACHE_TTL: {
    SHORT: 5 * 60 * 1000, // 5 minutes
    MEDIUM: 30 * 60 * 1000, // 30 minutes  
    LONG: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // External API URLs
  EXTERNAL_APIS: {
    BEEHIIV: 'https://api.beehiiv.com/v2',
    GITHUB: 'https://api.github.com',
    OPENAI: 'https://api.openai.com/v1',
  },
  
  // File upload limits
  UPLOAD_LIMITS: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  
  // Security
  SECURITY: {
    BCRYPT_ROUNDS: 12,
    JWT_EXPIRY: '7d',
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Feature flags
  FEATURES: {
    ENABLE_ANALYTICS: process.env.NODE_ENV === 'production',
    ENABLE_RATE_LIMITING: process.env.NODE_ENV === 'production',
    ENABLE_CSP: process.env.NODE_ENV === 'production',
    DEBUG_LOGGING: process.env.NODE_ENV === 'development',
  },
} as const

export const API_ROUTES = {
  SEARCH: '/api/search',
  FETCH_URL: '/api/fetch-url',
  PROCESS_FEEDS: '/api/process-feeds',
  SYNC_NEWSLETTER: '/api/sync-newsletter',
  TRIGGER_GITHUB_ACTION: '/api/trigger-github-action',
} as const

export const DATABASE_TABLES = {
  CONTENT_POST: 'content_post',
  CONTENT_SITE: 'content_site', 
  CONTENT_TOOL: 'content_tool',
  CONTENT_RESOURCE: 'content_resource',
  CONTENT_RESOURCE_CATEGORY: 'content_resource_category',
  CONTENT_BOOK: 'content_book',
  CONTENT_TOPIC: 'content_topic',
  USER_PROFILES: 'user_profiles',
  SEARCH_HISTORY: 'search_history',
  NEWSLETTER_POSTS: 'newsletter_posts',
} as const

export const POST_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'You must be signed in to perform this action',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  VALIDATION_ERROR: 'Invalid input data provided',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  INTERNAL_ERROR: 'An internal server error occurred. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
} as const

export const SUCCESS_MESSAGES = {
  CONTENT_SUBMITTED: 'Content submitted successfully',
  PROFILE_UPDATED: 'Profile updated successfully', 
  EMAIL_SENT: 'Email sent successfully',
  OPERATION_COMPLETED: 'Operation completed successfully',
} as const

// Type exports for better type safety
export type PostStatus = typeof POST_STATUS[keyof typeof POST_STATUS]
export type DatabaseTable = typeof DATABASE_TABLES[keyof typeof DATABASE_TABLES]
export type ApiRoute = typeof API_ROUTES[keyof typeof API_ROUTES]
