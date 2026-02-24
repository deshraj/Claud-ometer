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
  cacheReadTokens: number
): number {
  const pricing = MODEL_PRICING[model] || findClosestPricing(model);
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion +
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion
  );
}

function findClosestPricing(model: string): ModelPricing | null {
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    const family = key.includes('opus') ? 'opus' : key.includes('sonnet') ? 'sonnet' : 'haiku';
    if (model.includes(family)) return pricing;
  }
  return MODEL_PRICING['claude-sonnet-4-5-20250929'];
}
