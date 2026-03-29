'use client';

import { useCostMode } from '@/lib/cost-mode-context';
import { COST_MODE_LABELS } from '@/config/pricing';
import type { CostMode } from '@/config/pricing';

const modes: CostMode[] = ['subscription', 'conservative', 'api'];

export function CostModeSelector() {
  const { costMode, setCostMode } = useCostMode();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => setCostMode(mode)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            costMode === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={COST_MODE_LABELS[mode].description}
        >
          {COST_MODE_LABELS[mode].name}
        </button>
      ))}
    </div>
  );
}
