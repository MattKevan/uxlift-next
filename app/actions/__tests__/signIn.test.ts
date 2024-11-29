// /app/actions/tests/signIn.test.ts

import { signInAction } from '@/app/actions/actions'
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

// Mock the encodedRedirect utility with correct types
jest.mock('@/utils/utils', () => ({
  encodedRedirect: jest.fn((type: "error" | "success", path: string, message: string) => 
    redirect(`${path}?${type}=${encodeURIComponent(message)}`)
  )
}))

describe('signInAction', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabaseClient = {
      auth: {
        signInWithPassword: jest.fn()
      }
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabaseClient)
  })

  it('successfully signs in user and redirects to feed', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ error: null })
    
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')

    await signInAction(formData)

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    })

    expect(redirect).toHaveBeenCalledWith('/feed')
  })

  it('handles sign in error correctly', async () => {
    const errorMessage = 'Invalid credentials'
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      error: { message: errorMessage }
    })

    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'wrongpassword')

    await signInAction(formData)

    // Verify encodedRedirect was called with correct parameters and types
    expect(encodedRedirect).toHaveBeenCalledWith(
      'error',
      '/sign-in',
      errorMessage
    )

    // Verify the redirect URL is correctly formatted
    expect(redirect).toHaveBeenCalledWith(
      `/sign-in?error=${encodeURIComponent(errorMessage)}`
    )
  })

  it('handles missing credentials', async () => {
    const formData = new FormData()
    
    await signInAction(formData)

    // Verify the error handling for missing credentials
    expect(encodedRedirect).toHaveBeenCalledWith(
      'error',
      '/sign-in',
      'Email and password are required'
    )

    // Verify the redirect URL is correctly formatted
    expect(redirect).toHaveBeenCalledWith(
      '/sign-in?error=Email%20and%20password%20are%20required'
    )
  })
})