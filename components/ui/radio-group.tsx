'use client'

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid gap-3', className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        /* Square checkbox look — DS spec */
        'relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px]',
        'border-2 border-[#ccc] bg-white outline-none',
        'transition-[border-color,background-color,box-shadow] duration-150',
        'hover:border-[#7B2D5E]',
        'focus-visible:shadow-[0_0_0_2px_#F5A800]',
        'data-[state=checked]:border-[#7B2D5E] data-[state=checked]:bg-[#7B2D5E]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[#D32F2F]',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
