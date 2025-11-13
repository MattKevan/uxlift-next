// Simple in-memory rate limiting (no Redis required)
import { NextRequest, NextResponse } from 'next/server'
import { logger, logSecurityEvent } from './logger'

interface RateLimitEntry {
  count: number
  resetTime: number
  lastRequest: number
}

interface RateLimitConfig {
  requests: number
  windowMs: number
}

// In-memory store (will reset on server restart - that's fine for basic protection)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  const keysToDelete: string[] = []
  
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => rateLimitStore.delete(key))
}, 5 * 60 * 1000)

// Rate limit configurations
export const RATE_LIMITS = {
  AUTH: { requests: 5, windowMs: 10 * 60 * 1000 }, // 5 requests per 10 minutes
  SEARCH: { requests: 50, windowMs: 60 * 60 * 1000 }, // 50 requests per hour
  SUBMIT_CONTENT: { requests: 10, windowMs: 60 * 60 * 1000 }, // 10 requests per hour
  API_GENERAL: { requests: 100, windowMs: 60 * 60 * 1000 }, // 100 requests per hour
}

// Helper function to get client identifier
export function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from headers (if authenticated)
  const userId = request.headers.get('x-user-id')
  if (userId) return `user:${userId}`

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
              request.headers.get('x-real-ip') || 
              request.headers.get('cf-connecting-ip') || 
              'unknown'
  return `ip:${ip}`
}

// Simple rate limiting function
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  endpoint: string
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const windowStart = now - config.windowMs
  
  let entry = rateLimitStore.get(identifier)
  
  // Create new entry if doesn't exist or window has expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
      lastRequest: now
    }
  }
  
  // Clean up if outside current window
  if (entry.lastRequest < windowStart) {
    entry.count = 0
    entry.resetTime = now + config.windowMs
  }
  
  // Increment counter
  entry.count += 1
  entry.lastRequest = now
  rateLimitStore.set(identifier, entry)
  
  const allowed = entry.count <= config.requests
  const remaining = Math.max(0, config.requests - entry.count)
  
  if (!allowed) {
    logSecurityEvent('Rate limit exceeded', {
      endpoint,
      identifier,
      count: entry.count,
      limit: config.requests,
      resetTime: entry.resetTime
    })
  }
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime
  }
}

// Rate limit middleware function
export async function simpleRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  endpoint: string
): Promise<NextResponse | null> {
  // Skip rate limiting in development
  if (process.env.NODE_ENV === 'development') {
    return null
  }
  
  const identifier = getClientIdentifier(request)
  const result = checkRateLimit(identifier, config, endpoint)
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
    
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retryAfter
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.requests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': retryAfter.toString(),
        }
      }
    )
  }

  return null
}

// Convenience functions for specific endpoints
export async function checkAuthRateLimit(request: NextRequest): Promise<NextResponse | null> {
  return simpleRateLimit(request, RATE_LIMITS.AUTH, 'auth')
}

export async function checkApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
  return simpleRateLimit(request, RATE_LIMITS.API_GENERAL, 'api')
}

export async function checkSearchRateLimit(request: NextRequest): Promise<NextResponse | null> {
  return simpleRateLimit(request, RATE_LIMITS.SEARCH, 'search')
}

export async function checkSubmitContentRateLimit(request: NextRequest): Promise<NextResponse | null> {
  return simpleRateLimit(request, RATE_LIMITS.SUBMIT_CONTENT, 'submit-content')
}

// Get current rate limit status (useful for debugging)
export function getRateLimitStatus(identifier: string): RateLimitEntry | null {
  return rateLimitStore.get(identifier) || null
}

// Clear rate limit for a specific identifier (useful for admin override)
export function clearRateLimit(identifier: string): boolean {
  return rateLimitStore.delete(identifier)
}