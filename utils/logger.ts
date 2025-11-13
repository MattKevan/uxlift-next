// Centralized logging system with environment-based levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  requestId?: string
  component?: string
  action?: string
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? JSON.stringify(context) : ''
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${contextStr}`
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true
    if (this.isProduction) {
      // In production, only log warnings and errors
      return ['warn', 'error'].includes(level)
    }
    return true
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorInfo = error instanceof Error 
        ? { message: error.message, stack: this.isDevelopment ? error.stack : undefined }
        : error
      
      console.error(this.formatMessage('error', message, { ...context, error: errorInfo }))
    }
  }

  // Security-specific logging
  security(message: string, context?: LogContext): void {
    // Always log security events, even in production
    console.error(this.formatMessage('error', `SECURITY: ${message}`, context))
  }
}

export const logger = new Logger()

// Utility functions for common logging patterns
export const logApiRequest = (method: string, url: string, userId?: string, requestId?: string) => {
  logger.info(`API ${method} ${url}`, { userId, requestId, component: 'api' })
}

export const logApiError = (method: string, url: string, error: Error, userId?: string) => {
  logger.error(`API ${method} ${url} failed`, error, { userId, component: 'api' })
}

export const logDatabaseQuery = (table: string, operation: string, context?: LogContext) => {
  logger.debug(`DB ${operation} on ${table}`, { ...context, component: 'database' })
}

export const logSecurityEvent = (event: string, context?: LogContext) => {
  logger.security(event, context)
}