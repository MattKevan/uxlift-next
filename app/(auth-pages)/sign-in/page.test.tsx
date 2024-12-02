import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Login from '@/app/sign-in/page'
import { signInAction } from '@/app/actions/actions'
import type { Message } from '@/components/form-message'

// Mock the next/link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Mock the server action
jest.mock('@/app/actions/actions', () => ({
  signInAction: jest.fn()
}))

// Mock the useFormStatus hook
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  useFormStatus: () => ({
    pending: false
  })
}))

describe('Login Page', () => {
  const errorMessage: Message = { error: 'Invalid credentials' }
  const emptyMessage: Message = { message: '' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders login form with all necessary elements', async () => {
    render(
      await Login({ searchParams: Promise.resolve(emptyMessage) })
    )

    // Use heading role to specifically find the h1
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
    // Use button role to specifically find the submit button
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })

  it('has required attributes on form fields', async () => {
    render(
      await Login({ searchParams: Promise.resolve(emptyMessage) })
    )

    expect(screen.getByLabelText(/email/i)).toHaveAttribute('required')
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('required')
  })

  it('shows correct placeholder text', async () => {
    render(
      await Login({ searchParams: Promise.resolve(emptyMessage) })
    )

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
  })


  it('displays error message when provided', async () => {
    render(
      await Login({ searchParams: Promise.resolve(errorMessage) })
    )

    const message = screen.getByText('Invalid credentials')
    expect(message).toBeInTheDocument()
  })
})