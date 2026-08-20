'use client';

import { PanelLeft } from 'lucide-react';
import { useSidebar } from '@/context/sidebar-context'


interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
const { toggle } = useSidebar()
  return (
    <div className="bg-bg-base border-b border-border-low">
      <div className="flex items-center gap-3 md:gap-4 px-4 md:px-8 py-4 md:py-6">
        <button
          type="button"
          onClick={toggle}
          aria-label="Alternar menú"
          className="flex-shrink-0 text-content-low hover:text-content-high transition-colors"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-sans text-[22px] md:text-[32px] font-light leading-[120%] text-content-high">
            {title}
          </h1>
          {subtitle && (
            <p className="ds-body-sm text-[var(--color-core-piedra-40)]">
              {subtitle}
            </p>
          )}
        </div>      
      </div>
    </div>
  );
}
