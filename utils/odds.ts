import { calculateOdds } from './math';
import type { Outcome } from '@/types';

export type EffectiveOutcome = {
  id: string;
  label: string;
  outcome_slug?: string;
  price: number;
  normalizedPrice: number;
  effectivePrice: number;
  feeRate: number;
};

// Normalizuje ceny outcomes a aplikuje fee
export function buildEffectiveOutcomePricing(outcomes: Outcome[]) {
  const pricedOutcomes = outcomes.length > 0
    ? calculateOdds(
        outcomes.map(o => ({
          id: o.id,
          label: o.label,
          pool: o.pool,
          outcome_slug: o.outcome_slug
        }))
      )
    : [];

  const baseTotal = pricedOutcomes.reduce((sum, outcome) => {
    return sum + Math.max(0, Number(outcome.price) || 0);
  }, 0);

  const feeById = new Map(outcomes.map(outcome => [outcome.id, outcome.current_fee_rate ?? 0]));

  const effectiveOutcomes: EffectiveOutcome[] = pricedOutcomes.map(outcome => {
    const rawPrice = Math.max(0, Number(outcome.price) || 0);
    const normalizedPrice = baseTotal > 0 ? rawPrice / baseTotal : rawPrice;
    const feeRate = feeById.get(outcome.id) ?? 0;
    const effectivePrice = normalizedPrice * (1 + feeRate);

    return {
      id: outcome.id,
      label: outcome.label,
      outcome_slug: outcome.outcome_slug,
      price: rawPrice,
      normalizedPrice,
      effectivePrice,
      feeRate
    };
  });

  const effectiveById = new Map(effectiveOutcomes.map(outcome => [outcome.id, outcome.effectivePrice]));
  const normalizedById = new Map(effectiveOutcomes.map(outcome => [outcome.id, outcome.normalizedPrice]));
  const totalEffective = effectiveOutcomes.reduce((sum, outcome) => sum + outcome.effectivePrice, 0);

  return {
    pricedOutcomes,
    effectiveOutcomes,
    effectiveById,
    normalizedById,
    totalEffective
  };
}
