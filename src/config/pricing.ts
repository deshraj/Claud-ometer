export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': { inputPerMillion: 15, outputPerMillion: 75, cacheWritePerMillion: 18.75, cacheReadPerMillion: 1.50 },
  'claude-opus-4-5-20251101': { inputPerMillion: 15, outputPerMillion: 75, cacheWritePerMillion: 18.75, cacheReadPerMillion: 1.50 },
  'claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.30 },
  'claude-sonnet-4-5-20250929': { inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.30 },
  'claude-haiku-4-5-20251001': { inputPerMillion: 0.80, outputPerMillion: 4, cacheWritePerMillion: 1.00, cacheReadPerMillion: 0.08 },
};

/**
 * Cost estimation modes:
 *
 * "api"          — Raw API-equivalent cost. All 4 token types at published API rates.
 *                  Useful for comparing what this usage would cost on the API.
 *                  Typically 5-8x higher than what a Claude Code subscriber actually pays.
 *
 * "conservative" — Discounted estimate. Output tokens at full price, input at full price,
 *                  cache writes at 50% discount, cache reads at 90% discount.
 *                  Reflects that Anthropic likely doesn't charge subscription users
 *                  full API rate for cached context. Lands ~2-3x above real spend.
 *
 * "subscription" — Subscription-friendly estimate. Designed to approximate real Claude Code
 *                  plan billing. Output at full price, input at full price, cache tokens
 *                  heavily discounted (cache writes 80% off, cache reads 95% off).
 *                  For a $100/mo + overage plan, this tracks much closer to reality.
 */
export type CostMode = 'api' | 'conservative' | 'subscription';

export const COST_MODE_LABELS: Record<CostMode, { name: string; description: string }> = {
  api: {
    name: 'API Equivalent',
    description: 'What this usage would cost at published API rates',
  },
  conservative: {
    name: 'Conservative',
    description: 'Discounted cache tokens — upper bound for subscription users',
  },
  subscription: {
    name: 'Subscription',
    description: 'Approximates real Claude Code plan billing',
  },
};

// Multipliers applied to cache token costs relative to their API price
const COST_MODE_MULTIPLIERS: Record<CostMode, { cacheWrite: number; cacheRead: number }> = {
  api:          { cacheWrite: 1.0,  cacheRead: 1.0  },
  conservative: { cacheWrite: 0.15, cacheRead: 0.05 },
  subscription: { cacheWrite: 0.08, cacheRead: 0.01 },
};

export const DEFAULT_COST_MODE: CostMode = 'subscription';

export function getModelDisplayName(modelId: string): string {
  if (modelId.includes('opus')) return 'Opus';
  if (modelId.includes('sonnet')) return 'Sonnet';
  if (modelId.includes('haiku')) return 'Haiku';
  return modelId;
}

export function getModelColor(modelId: string): string {
  if (modelId.includes('opus')) return '#D4764E';
  if (modelId.includes('sonnet')) return '#6B8AE6';
  if (modelId.includes('haiku')) return '#5CB87A';
  return '#888888';
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number,
  cacheReadTokens: number,
  mode: CostMode = DEFAULT_COST_MODE
): number {
  const pricing = MODEL_PRICING[model] || findClosestPricing(model);
  if (!pricing) return 0;
  const multipliers = COST_MODE_MULTIPLIERS[mode];
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion * multipliers.cacheWrite +
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion * multipliers.cacheRead
  );
}

/** Calculate cost in all three modes at once (avoids triple-parsing in hot paths) */
export function calculateCostAllModes(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number,
  cacheReadTokens: number
): Record<CostMode, number> {
  const pricing = MODEL_PRICING[model] || findClosestPricing(model);
  if (!pricing) return { api: 0, conservative: 0, subscription: 0 };

  const baseCost =
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;

  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;

  return {
    api: baseCost + cacheWriteCost + cacheReadCost,
    conservative: baseCost + cacheWriteCost * 0.15 + cacheReadCost * 0.05,
    subscription: baseCost + cacheWriteCost * 0.08 + cacheReadCost * 0.01,
  };
}

function findClosestPricing(model: string): ModelPricing | null {
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    const family = key.includes('opus') ? 'opus' : key.includes('sonnet') ? 'sonnet' : 'haiku';
    if (model.includes(family)) return pricing;
  }
  return MODEL_PRICING['claude-sonnet-4-5-20250929'];
}
