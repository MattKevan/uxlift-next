// supabase/functions/process-feeds-worker/utils.ts
import { EdgeFunctionLogger } from '../_shared/logger.ts'

// Log error details
export function logErrorDetails(error: unknown, context?: Record<string, unknown>) {
  console.error('Error details:', {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : 'No stack trace',
    timestamp: new Date().toISOString(),
    context
  })
}

// Safe JSON parsing
export function safeJsonParse(text: string, defaultValue = {}) {
  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return defaultValue
  }
}

// Format error for response
export function formatErrorResponse(error: unknown) {
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error',
    errorType: error instanceof Error ? error.name : 'Unknown',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  }
}

// Safely end logger step
export async function safeEndStep(
  logger: EdgeFunctionLogger | null,
  stepName: string,
  success: boolean,
  message: string,
  details?: Record<string, unknown>
) {
  if (!logger) return
  
  try {
    await logger.endStep(stepName, success, message, details)
  } catch (error) {
    console.error(`Error ending logger step ${stepName}:`, error)
  }
}

// Safely complete logger
export async function safeCompleteLogger(
  logger: EdgeFunctionLogger | null,
  success: boolean,
  metrics?: { itemsProcessed?: number; itemsFailed?: number },
  error?: Error
) {
  if (!logger) return
  
  try {
    await logger.complete(success, metrics, error)
  } catch (logError) {
    console.error('Failed to log completion status:', logError)
  }
}

// Truncate string with ellipsis
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + '...'
}

// Safely handle promises
export async function safeAwait<T>(promise: Promise<T>): Promise<[T | null, Error | null]> {
  try {
    const result = await promise
    return [result, null]
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))]
  }
}