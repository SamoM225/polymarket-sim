export interface OutcomeRaw {
  id: string;
  label: string;
  pool: number;
  outcome_slug?: string;
}

export interface OutcomeWithPrice extends OutcomeRaw {
  price: number;
  priceDisplay: string;
  probability: string;
}

// Vypocet kurzov z poolov (1/pool vzorec)
export function calculateOdds(outcomes: OutcomeRaw[]): OutcomeWithPrice[] {
  if (!outcomes || outcomes.length === 0) return [];

  const outcomesWithWeights = outcomes.map(o => {
    const pool = Math.max(o.pool, 0.0001);
    return {
      ...o,
      weight: 1 / pool 
    };
  });

  const totalWeight = outcomesWithWeights.reduce((sum, o) => sum + o.weight, 0);

  if (totalWeight === 0) {
    return outcomes.map(o => ({
      ...o,
      price: 1 / outcomes.length,
      priceDisplay: `${Math.round((1 / outcomes.length) * 100)}¢`,
      probability: `${((1 / outcomes.length) * 100).toFixed(1)}%`
    }));
  }

  return outcomesWithWeights.map(o => {
    const rawPrice = o.weight / totalWeight;
    
    const roundedPrice = Math.round(rawPrice * 100) / 100;
    const centsPrice = Math.round(roundedPrice * 100);
    const percentPrice = (roundedPrice * 100).toFixed(1);
    
    return {
      id: o.id,
      label: o.label,
      pool: o.pool,
      outcome_slug: o.outcome_slug,
      price: roundedPrice, 
      priceDisplay: `${centsPrice}¢`,
      probability: `${percentPrice}%`
    };
  });
}

// Buy price = base * 1.01
export function calculateBuyPrice(basePrice: number): number {
  return basePrice * 1.01;
}

// Sell price = base * 0.99
export function calculateSellPrice(basePrice: number): number {
  return basePrice * 0.99;
}

export function calculateSinglePrice(outcome: OutcomeRaw, allOutcomes: OutcomeRaw[]): number {
  const withPrices = calculateOdds(allOutcomes);
  return withPrices.find(o => o.id === outcome.id)?.price ?? 0;
}

export function formatPrice(price: number): { display: string; percent: string } {
  const centsPrice = Math.floor(price * 100);
  const percentPrice = (price * 100).toFixed(1);
  
  return {
    display: `${centsPrice}¢`,
    percent: `${percentPrice}%`
  };
}

export type OddsFormat = 'EU' | 'US' | 'UK';

// Konverzia probability na kurzy (EU/US/UK)
export function convertOdds(probability: number, format: OddsFormat): string {
  if (probability <= 0 || probability >= 1) {
    return format === 'EU' ? '∞' : format === 'US' ? '-' : '∞';
  }

  switch (format) {
    case 'EU': {
      const decimal = 1 / probability;
      return decimal.toFixed(2);
    }
    case 'US': {
      if (probability >= 0.5) {
        const moneyline = -100 * (probability / (1 - probability));
        return Math.round(moneyline).toString();
      } else {
        const moneyline = 100 * ((1 - probability) / probability);
        return '+' + Math.round(moneyline).toString();
      }
    }
    case 'UK': {
      const decimal = (1 / probability) - 1;
      const tolerance = 0.0001;
      let numerator = 1;
      let denominator = 1;
      
      for (let d = 1; d <= 100; d++) {
        const n = Math.round(decimal * d);
        if (Math.abs(decimal - n / d) < tolerance) {
          numerator = n;
          denominator = d;
          break;
        }
      }
      
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(numerator, denominator);
      numerator = numerator / divisor;
      denominator = denominator / divisor;
      
      return `${numerator}/${denominator}`;
    }
    default:
      return (1 / probability).toFixed(2);
  }
}

export function formatOddsWithLabel(probability: number, format: OddsFormat): string {
  const odds = convertOdds(probability, format);
  return odds;
}
