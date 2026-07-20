import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-support-focus focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-primary text-accent-on-primary border border-accent-primary hover:bg-accent-primary/90 active:bg-accent-primary/80",

        default:
          "bg-bg-surface-low text-content-high border border-border-low hover:bg-bg-surface-md",

        destructive:
          'bg-support-error text-support-on-error hover:bg-support-error/90 active:bg-support-error/80 focus-visible:ring-support-error/20',
        'destructive-low':
          'bg-support-error-low text-support-on-error-low hover:bg-support-error-low/80 active:bg-support-error-low/70',
        outline:
          '[border-width:1.5px] border-accent-primary bg-bg-base text-accent-primary hover:bg-accent-primary-low active:bg-accent-primary-low/70 shadow-none',
        secondary:
          'bg-accent-secondary text-accent-on-secondary hover:bg-accent-secondary/90 active:bg-accent-secondary/80',
        ghost:
          'bg-transparent text-content-low hover:bg-reactive-surface-hover hover:text-content-high active:bg-reactive-surface-pressed',
        link: 'text-accent-secondary underline-offset-4 hover:underline',
        vino:
          'bg-accent-primary text-accent-on-primary hover:bg-accent-primary/90 active:bg-accent-primary/80',
      },
      size: {
        default: "h-10 px-6",
        sm: "h-8 px-4",
        lg: "h-12 px-8",
         icon: 'size-10 rounded-full',
         'icon-sm': 'size-8 rounded-full',
         'icon-lg': 'size-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
