'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { CheckIcon, MinusIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer group size-4 shrink-0 rounded-[4px] outline-none',
        'border-2 border-[#ccc] bg-white',
        'transition-[border-color,background-color,box-shadow] duration-150',
        'hover:border-[#7B2D5E]',
        'data-[state=checked]:bg-[#7B2D5E] data-[state=checked]:border-[#7B2D5E] data-[state=checked]:text-white',
        'data-[state=indeterminate]:bg-[#7B2D5E] data-[state=indeterminate]:border-[#7B2D5E] data-[state=indeterminate]:text-white',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[#D32F2F]',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden" />
        <MinusIcon className="size-3.5 hidden group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
