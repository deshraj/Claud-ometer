'use client';

import { type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CostModeProvider } from '@/lib/cost-mode-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CostModeProvider>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </CostModeProvider>
  );
}
