import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'ds-input flex field-sizing-content min-h-16 w-full text-sm font-light outline-none',
        'rounded-xl border px-3 py-2 bg-bg-base text-content-high resize-y',
        'placeholder:text-content-low placeholder:font-light',
        'transition-colors',
        'focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
