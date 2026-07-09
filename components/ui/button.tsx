import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#D9A300] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
         primary:
          "bg-[#773357] text-white border border-[#773357] hover:bg-[#773357] hover:text-white active:bg-[#773357] active:text-white focus:bg-[#773357] focus:text-white",

        default:
          "bg-[#f5f4f2] text-[#2e3b2b] border border-[#e4e3d6] hover:bg-[#eeece7] dark:bg-[#26261e] dark:text-[#f1f1f0] dark:border-white/10 dark:hover:bg-[#2e2e24]",

        destructive:
          'bg-destructive text-white hover:bg-[#b82a2e] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        'destructive-low':
          'bg-[#ffd6d7] text-[#87090c] hover:bg-[#ffbcbe]',
        outline:
          '[border-width:1.5px] border-[#773357] bg-white text-[#773357] hover:bg-[#773357]/5 shadow-none',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[#5a6047]',
        ghost:
          'bg-transparent text-[#5d5e5f] hover:bg-secondary/10 hover:text-foreground dark:text-[#b8b9b9]',
        link: 'text-primary underline-offset-4 hover:underline',
        vino:
          'bg-[#773357] text-white hover:bg-[#773357] hover:text-white active:bg-[#773357] active:text-white focus:bg-[#773357] focus:text-white',
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
