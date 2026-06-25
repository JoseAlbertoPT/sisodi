import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'flex items-start gap-3 rounded-[8px] border-l-4 px-4 py-3 text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:mt-0.5',
  {
    variants: {
      variant: {
        info:        'bg-[#EFF6FF] border-l-[#3B82F6] [&>svg]:text-[#3B82F6]',
        success:     'bg-[#F0FDF4] border-l-[#22C55E] [&>svg]:text-[#16A34A]',
        warning:     'bg-[#FFFBEB] border-l-[#F5A800] [&>svg]:text-[#D97706]',
        error:       'bg-[#FFF5F5] border-l-[#EF4444] [&>svg]:text-[#DC2626]',
        generic:     'bg-[#F9FAFB] border-l-[#9CA3AF] [&>svg]:text-[#6B7280]',
        default:     'bg-card border-l-[#ccc] text-card-foreground [&>svg]:text-muted-foreground',
        destructive: 'bg-[#FFF5F5] border-l-[#EF4444] [&>svg]:text-[#DC2626]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  onDismiss,
  children,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants> & {
    onDismiss?: () => void
  }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          className="ml-auto shrink-0 self-start rounded-full p-0.5 opacity-60 transition-all hover:opacity-100 hover:bg-black/10"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('font-semibold leading-snug', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('text-sm opacity-90 mt-0.5 [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
