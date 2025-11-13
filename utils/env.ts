// Environment variable validation and configuration
import { logger } from './logger'
import type { RequiredEnvVars, OptionalEnvVars } from '@/types/api'

// Required environment variables
const requiredEnvVars: Array<keyof RequiredEnvVars> = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'PINECONE_API_KEY',
  'PINECONE_INDEX_NAME',
  'BEEHIIV_API_KEY',
  'BEEHIIV_PUBLICATION_ID',
]

// Optional environment variables with defaults
const optionalEnvVars: Array<keyof OptionalEnvVars> = [
  'CRON_SECRET',
  'INTERNAL_SECRET',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
]

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvironmentError'
  }
}

export function validateEnvironment(): void {
  const missing: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    if (!value || value.trim() === '') {
      missing.push(envVar)
    }
  }

  // Check optional variables and warn if missing critical ones
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar]
    if (!value || value.trim() === '') {
      // Some optional vars are critical for production
      if (envVar === 'CRON_SECRET' && process.env.NODE_ENV === 'production') {
        warnings.push(`${envVar} should be set in production`)
      }
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('Environment configuration warnings', { warnings })
  }

  // Throw error for missing required variables
  if (missing.length > 0) {
    const error = new EnvironmentError(
      `Missing required environment variables: ${missing.join(', ')}`
    )
    logger.error('Environment validation failed', error, { missing })
    throw error
  }

  logger.info('Environment validation passed', {
    requiredVarsCount: requiredEnvVars.length,
    optionalVarsCount: optionalEnvVars.length,
    warningsCount: warnings.length
  })
}

export function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    if (fallback !== undefined) {
      logger.warn(`Using fallback value for ${name}`)
      return fallback
    }
    throw new EnvironmentError(`Environment variable ${name} is not set`)
  }
  return value.trim()
}

export function getOptionalEnvVar(name: string, fallback = ''): string {
  const value = process.env[name]
  return value?.trim() || fallback
}

// Validate on module load (except in tests)
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnvironment()
  } catch (error) {
    // In development, log error but don't crash
    if (process.env.NODE_ENV === 'development') {
      logger.error('Environment validation failed in development', error)
    } else {
      // In production, crash the app
      process.exit(1)
    }
  }
}