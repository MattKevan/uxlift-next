// Input validation schemas using Zod
import { z } from 'zod'
import { logger, logSecurityEvent } from './logger'

// URL validation schema
export const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .url('Must be a valid URL')
  .refine((url) => {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }, 'URL must use HTTP or HTTPS protocol')
  .refine((url) => {
    try {
      const parsed = new URL(url)
      // Block potentially dangerous hosts
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
      return !blockedHosts.some(host => parsed.hostname.includes(host))
    } catch {
      return false
    }
  }, 'URL host is not allowed')

// Search query validation
export const searchQuerySchema = z
  .string()
  .min(1, 'Search query is required')
  .max(500, 'Search query must be less than 500 characters')
  .refine((query) => {
    // Basic XSS prevention
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ]
    return !dangerousPatterns.some(pattern => pattern.test(query))
  }, 'Invalid characters in search query')

// Email validation
export const emailSchema = z
  .string()
  .email('Must be a valid email address')
  .max(320, 'Email address too long') // RFC 5321 limit

// Password validation
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .refine((password) => {
    // At least one lowercase, uppercase, number
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)
  }, 'Password must contain at least one uppercase, lowercase, and number')

// Generic text validation
export const safeTextSchema = z
  .string()
  .max(10000, 'Text too long')
  .refine((text) => {
    // Basic XSS prevention
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /data:text\/html/i
    ]
    return !dangerousPatterns.some(pattern => pattern.test(text))
  }, 'Invalid characters detected')

// Title validation
export const titleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(255, 'Title must be less than 255 characters')
  .refine((title) => {
    // Allow most characters but block obvious XSS attempts
    return !/<script|javascript:|on\w+\s*=/i.test(title)
  }, 'Invalid characters in title')

// Description validation
export const descriptionSchema = z
  .string()
  .max(2000, 'Description must be less than 2000 characters')
  .optional()
  .refine((desc) => {
    if (!desc) return true
    return !/<script|javascript:|on\w+\s*=/i.test(desc)
  }, 'Invalid characters in description')

// API request validation schemas
export const fetchUrlRequestSchema = z.object({
  url: urlSchema
})

export const searchRequestSchema = z.object({
  query: searchQuerySchema
})

export const authRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema
})

// Validation middleware function
export function validateInput<T>(
  schema: z.ZodSchema<T>, 
  data: unknown, 
  context?: { endpoint?: string, userId?: string }
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      
      // Log validation failures for security monitoring
      logSecurityEvent('Input validation failed', {
        ...context,
        errors: error.errors,
        data: typeof data === 'object' ? JSON.stringify(data) : data
      })
      
      return { success: false, error: errorMessage }
    }
    
    logger.error('Unexpected validation error', error, context)
    return { success: false, error: 'Validation failed' }
  }
}

// Helper function for API request validation
export function validateApiRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  endpoint: string
): T {
  const validation = validateInput(schema, data, { endpoint })
  
  if (!validation.success) {
    throw new Error(`Invalid request data: ${validation.error}`)
  }
  
  return validation.data
}