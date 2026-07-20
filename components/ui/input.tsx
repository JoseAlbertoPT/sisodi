import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'ds-input flex h-9 w-full rounded-xl border bg-bg-base px-3 py-2 text-sm font-light text-content-high transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-content-low placeholder:font-light',
        'focus:outline-none',
        'aria-invalid:border-destructive',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
