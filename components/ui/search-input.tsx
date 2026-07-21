'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
}

/**
 * Shared max-width presets for search inputs across the app.
 * Bump these to resize every buscador consistently instead of editing each page.
 */
export const SEARCH_INPUT_MAX_W_SM = 'max-w-[27rem]'
export const SEARCH_INPUT_MAX_W_MD = 'max-w-[31.5rem]'

export function SearchInput({ className, containerClassName, onChange, ...props }: SearchInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const trimmed = e.target.value.trimStart()
    if (trimmed !== e.target.value) {
      e.target.value = trimmed
    }
    onChange?.(e)
  }

  return (
    <div className={cn('relative w-full', containerClassName)}>
      <input
        type="text"
        onChange={handleChange}
        className={cn(
          'w-full h-9 rounded-xl border border-border bg-white shadow-sm',
          'pl-9 pr-4',
          'text-sm font-light text-foreground placeholder:text-[var(--sem-border-high)]',
          'outline-none transition-colors',
          'focus:border-[#2D3B2D] focus-visible:outline-none',
          className,
        )}
        {...props}
      />
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sem-border-high)]" />
    </div>
  )
}
