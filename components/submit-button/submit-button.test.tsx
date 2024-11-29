import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SubmitButton } from './submit-button'

// Mock the useFormStatus hook
let mockPending = false
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  useFormStatus: () => ({
    pending: mockPending
  })
}))

describe('SubmitButton', () => {
  beforeEach(() => {
    mockPending = false
  })

  it('renders with children when not pending', () => {
    render(<SubmitButton>Submit</SubmitButton>)
    expect(screen.getByRole('button')).toHaveTextContent('Submit')
  })

  it('renders pending text when pending', () => {
    mockPending = true
    render(<SubmitButton pendingText="Loading...">Submit</SubmitButton>)
    expect(screen.getByRole('button')).toHaveTextContent('Loading...')
  })

  it('is disabled when pending', () => {
    mockPending = true
    render(<SubmitButton>Submit</SubmitButton>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })
})