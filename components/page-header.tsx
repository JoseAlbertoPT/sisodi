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
      <div className="flex items-center gap-4 px-8 py-6">
        <button
          type="button"
          onClick={toggle}
          aria-label="Alternar sidebar"
          className="relative z-50 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-content-low transition-colors hover:bg-muted hover:text-content-high"

        >
          <PanelLeft className="h-5 w-5"  />
        </button>
        <div className="flex-1">
          <h1 className="font-sans text-[32px] font-light leading-[120%] text-content-high">
            {title}
          </h1>
          {subtitle && (
            <p className="ds-title-md">
              {subtitle}
            </p>
          )}
        </div>      
      </div>
    </div>
  );
}
