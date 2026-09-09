import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SerpPreview } from './SerpPreview'

describe('SerpPreview', () => {
  it('renders title, description and a URL from the path', () => {
    render(<SerpPreview title="My Page" description="A short summary." path="/about" />)
    expect(screen.getByText('My Page')).toBeInTheDocument()
    expect(screen.getByText('A short summary.')).toBeInTheDocument()
    expect(screen.getByText(/onvorx\.com\/about/i)).toBeInTheDocument()
  })
  it('shows placeholders when empty', () => {
    render(<SerpPreview title="" description="" path="/" />)
    expect(screen.getByText(/no title set/i)).toBeInTheDocument()
    expect(screen.getByText(/no description set/i)).toBeInTheDocument()
  })
})
