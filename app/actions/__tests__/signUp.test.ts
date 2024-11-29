// /app/actions/__tests__/signUp.test.ts

import { signUpAction } from '@/app/actions/actions'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { encodedRedirect } from '@/utils/utils'

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn()
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('@/utils/utils', () => ({
  encodedRedirect: jest.fn((type: "error" | "success", path: string, message: string) => 
    redirect(`${path}?${type}=${encodeURIComponent(message)}`)
  )
}))

// Mock environment variables
process.env.BEEHIIV_API_KEY = 'test-api-key'
process.env.BEEHIIV_PUBLICATION_ID = 'test-pub-id'

describe('signUpAction', () => {
  let mockSupabaseClient: any
  const originalConsoleError = console.error
  
  // Mock fetch globally
  global.fetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
    
    // Reset fetch mock for each test
    ;(global.fetch as jest.Mock).mockReset()
    
    mockSupabaseClient = {
      auth: {
        signUp: jest.fn()
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      upsert: jest.fn()
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabaseClient)
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('successfully signs up user and redirects to profile creation when no username exists', async () => {
    const userId = 'test-user-id'
    mockSupabaseClient.auth.signUp.mockResolvedValue({ 
      data: { user: { id: userId } },
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null })
        })
      }),
      upsert: jest.fn().mockResolvedValue({ error: null })
    })

    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')

    await signUpAction(formData)

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    })

    expect(redirect).toHaveBeenCalledWith('/profile/create')
  })

  it('handles missing email or password', async () => {
    const formData = new FormData()
    
    await signUpAction(formData)

    expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled()
    expect(encodedRedirect).not.toHaveBeenCalled()
    expect(signUpAction(formData)).resolves.toEqual({ 
      error: "Email and password are required" 
    })
  })

  it('handles signup error correctly', async () => {
    const errorMessage = 'Email already registered'
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: errorMessage }
    })

    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')

    await signUpAction(formData)

    expect(encodedRedirect).toHaveBeenCalledWith(
      'error',
      '/sign-up', 
      errorMessage
    )
  })

  it('redirects to profile edit when username exists', async () => {
    const userId = 'test-user-id'
    mockSupabaseClient.auth.signUp.mockResolvedValue({ 
      data: { user: { id: userId } },
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ 
            data: { username: 'existinguser' } 
          })
        })
      }),
      upsert: jest.fn().mockResolvedValue({ error: null })
    })

    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')

    await signUpAction(formData)

    expect(redirect).toHaveBeenCalledWith('/profile/edit')
  })

  it('handles newsletter subscription when checkbox is checked', async () => {
    const userId = 'test-user-id'
    const email = 'test@example.com'
    
    mockSupabaseClient.auth.signUp.mockResolvedValue({ 
      data: { user: { id: userId } },
      error: null 
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: { status: 'active' }
      })
    })

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null })
        })
      }),
      upsert: jest.fn().mockResolvedValue({ error: null })
    })

    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', 'password123')
    formData.append('newsletter', 'on')

    await signUpAction(formData)

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}/subscriptions`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining(email)
      })
    )

    expect(mockSupabaseClient.from().upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        newsletter_subscriber: true,
        username: email.split('@')[0]
      })
    )
  })

  it('handles newsletter subscription failure gracefully', async () => {
    const userId = 'test-user-id'
    
    mockSupabaseClient.auth.signUp.mockResolvedValue({ 
      data: { user: { id: userId } },
      error: null 
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Subscription failed')
    })

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null })
        })
      }),
      upsert: jest.fn().mockResolvedValue({ error: null })
    })

    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')
    formData.append('newsletter', 'on')

    await signUpAction(formData)

    expect(console.error).toHaveBeenCalledWith(
      'Failed to subscribe to newsletter:',
      'Subscription failed'
    )

    expect(mockSupabaseClient.from().upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        newsletter_subscriber: false
      })
    )
  })
})