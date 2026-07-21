'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, X } from 'lucide-react'

interface ConfirmToastProps {
  variant: 'success' | 'error'
  title: string
  description?: string
  duration?: number
}

export function ConfirmToast({ variant, title, description, duration = 40000 }: ConfirmToastProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting' | 'gone'>('entering')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 10)
    const t2 = setTimeout(() => setPhase('exiting'), duration)
    const t3 = setTimeout(() => setPhase('gone'), duration + 300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [duration])

  const handleClose = () => {
    if (phase === 'gone') return
    setPhase('exiting')
    setTimeout(() => setPhase('gone'), 300)
  }

  if (phase === 'gone') return null

  const isVisible = phase === 'visible'
  const isSuccess = variant === 'success'

  return (
    <div
      className="fixed top-4 right-4 z-[200] pointer-events-auto"
      style={{
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(-12px)',
        maxWidth: 360,
        minWidth: 280,
      }}
    >
      <div
        className="flex items-start gap-3 bg-white"
        style={{ borderRadius: 12, padding: '16px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
      >
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 40, height: 40, borderRadius: 12, background: isSuccess ? '#DCFCE7' : '#FEE2E2' }}
        >
          {isSuccess
            ? <CheckCircle2 style={{ width: 20, height: 20, color: '#16A34A' }} />
            : <FileText style={{ width: 20, height: 20, color: 'var(--sem-support-error)' }} />
          }
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold leading-snug" style={{ color: '#111827' }}>
            {title}
          </p>
          {description && (
            <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--sem-content-low)' }}>
              {description}
            </p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 flex items-center justify-center rounded-full hover:bg-[var(--sem-support-disabled-low)] transition-colors"
          style={{ width: 24, height: 24, color: 'var(--sem-border-high)', marginTop: -2 }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  )
}
