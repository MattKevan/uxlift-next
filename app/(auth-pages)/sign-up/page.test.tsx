// /app/sign-up/page.test.tsx

import { render, screen } from '@testing-library/react'
import SignUp from './page'
import { Message } from '@/components/form-message'

// Mock the submit button component to avoid useFormStatus issues
jest.mock('@/components/submit-button/submit-button', () => ({
  SubmitButton: ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <button className={className}>{children}</button>
  )
}))

// Mock the checkbox component
jest.mock('@/components/catalyst/checkbox', () => ({
  Checkbox: ({ id, name }: { id: string, name: string }) => (
    <input type="checkbox" id={id} name={name} />
  )
}))

// Mock form message component
jest.mock('@/components/form-message', () => ({
  FormMessage: ({ message }: { message: Message }) => (
    <div>
      {message && ('success' in message 
        ? message.success 
        : 'error' in message 
        ? message.error 
        : message.message)}
    </div>
  )
}))

describe('SignUp', () => {
  it('renders signup form correctly', async () => {
    // Use an error message to avoid the "message" condition
    const mockSearchParams = Promise.resolve({ error: '' }) as Promise<Message>

    render(await SignUp({ searchParams: mockSearchParams }))

    // Check main elements are present
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/your password/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByText(/already have an account\?/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('displays message div when message is provided', async () => {
    const mockMessage: Promise<Message> = Promise.resolve({
      message: 'Test message'
    })

    render(await SignUp({ searchParams: mockMessage }))
    
    // Should show message div and not the form
    expect(screen.getByText('Test message')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /sign up/i })).not.toBeInTheDocument()
  })

  it('displays error message in form when provided', async () => {
    const mockMessage: Promise<Message> = Promise.resolve({
      error: 'Test error message'
    })

    render(await SignUp({ searchParams: mockMessage }))
    
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    // Form should still be visible
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
  })

  it('displays success message in form when provided', async () => {
    const mockMessage: Promise<Message> = Promise.resolve({
      success: 'Test success message'
    })

    render(await SignUp({ searchParams: mockMessage }))
    
    expect(screen.getByText('Test success message')).toBeInTheDocument()
    // Form should still be visible
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument()
  })

  it('has required fields', async () => {
    const mockSearchParams = Promise.resolve({ error: '' }) as Promise<Message>

    render(await SignUp({ searchParams: mockSearchParams }))

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const passwordInput = screen.getByPlaceholderText(/your password/i)

    expect(emailInput).toHaveAttribute('required')
    expect(passwordInput).toHaveAttribute('required')
  })

  it('has correct link to sign in page', async () => {
    const mockSearchParams = Promise.resolve({ error: '' }) as Promise<Message>

    render(await SignUp({ searchParams: mockSearchParams }))

    const signInLink = screen.getByRole('link', { name: /sign in/i })
    expect(signInLink).toHaveAttribute('href', '/sign-in')
  })
})