import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full text-base outline-none md:text-sm',
        'rounded-xl border-[1.5px] border-[#ccc] px-4 py-3 bg-white resize-y',
        'placeholder:text-muted-foreground',
        'transition-[color,box-shadow,background-color,border-color] duration-150',
        'hover:bg-[#f5f5f5]',
        'focus-visible:border-[#F5A800] focus-visible:bg-[#FFF8E1] focus-visible:ring-0',
        'disabled:cursor-not-allowed disabled:bg-[#f0f0f0] disabled:border-[#ddd] disabled:text-[#aaa]',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
