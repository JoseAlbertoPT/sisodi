'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
}

export function SearchInput({ className, containerClassName, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative w-full', containerClassName)}>
      <input
        type="text"
        className={cn(
          'w-full rounded-full border-[1.5px] border-[#E5E7EB] bg-white',
          'py-[10px] pl-4 pr-10',
          'text-sm text-foreground placeholder:text-[#9CA3AF]',
          'outline-none transition-colors',
          'focus:border-[#2D3B2D]',
          className,
        )}
        {...props}
      />
      <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
    </div>
  )
}
