'use client';

import { useState, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMultiOutcomePriceHistory } from '@/lib/hooks';
import { TrendingUp, Activity } from 'lucide-react';
import { Outcome } from '@/types';
import { calculateOdds } from '@/utils/math';

interface PriceChartProps {
  marketId: string | null;
  outcomes: Outcome[];
  homeTeamName?: string;
  awayTeamName?: string;
  selectedOutcomeId?: string | null;
}

type Timeframe = '1H' | '4H' | '1D' | '1W' | '1M';

const OUTCOME_COLORS = {
  home: '#3b82f6',
  draw: '#6b7280',
  away: '#22c55e',
  yes: '#3b82f6',
  no: '#ef4444',
};

export default function PriceChart({ marketId, outcomes, homeTeamName = 'Home', awayTeamName = 'Away', selectedOutcomeId }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  
  const outcomesKey = outcomes.map(o => o.id).sort().join(',');
  const stableOutcomesRef = useRef(outcomes);
  if (outcomes.map(o => o.id).sort().join(',') !== stableOutcomesRef.current.map(o => o.id).sort().join(',')) {
    stableOutcomesRef.current = outcomes;
  }
  const stableOutcomes = stableOutcomesRef.current;
  
  const outcomesList = useMemo(() => {
    const slugCounts = new Map<string, number>();
    stableOutcomes.forEach(outcome => {
      const slug = outcome.outcome_slug || '';
      if (!slug) return;
      slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
    });

    return stableOutcomes.map(outcome => {
      const baseSlug = outcome.outcome_slug || '';
      const isDuplicate = !baseSlug || (slugCounts.get(baseSlug) ?? 0) > 1;
      return {
        id: outcome.id,
        label: outcome.label,
        slug: isDuplicate ? outcome.id : baseSlug
      };
    });
  }, [outcomesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const outcomeLabelById = useMemo(() => {
    return new Map(outcomesList.map(outcome => [outcome.id, outcome.label]));
  }, [outcomesList]);
  const outcomeLabelBySlug = useMemo(() => {
    return new Map(outcomesList.map(outcome => [outcome.slug, outcome.label]));
  }, [outcomesList]);
  const outcomeSlugById = useMemo(() => {
    return new Map(outcomesList.map(outcome => [outcome.id, outcome.slug]));
  }, [outcomesList]);
  const outcomeColorById = useMemo(() => {
    const palette = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6'];
    const map = new Map<string, string>();
    outcomesList.forEach((outcome, index) => {
      const preset = OUTCOME_COLORS[outcome.slug as keyof typeof OUTCOME_COLORS];
      if (preset) {
        map.set(outcome.id, preset);
      } else {
        map.set(outcome.id, palette[index % palette.length]);
      }
    });
    return map;
  }, [outcomesList]);

  const isSingleOutcomeView = !!selectedOutcomeId;

  const isMultiOutcome = outcomes.length > 4;
  const topOutcomeIds = useMemo(() => {
    if (selectedOutcomeId) {
      return new Set([selectedOutcomeId]);
    }
    if (!isMultiOutcome) return new Set(outcomes.map(o => o.id));
    
    const sorted = [...outcomes].sort((a, b) => {
      const poolA = Number(a.pool) || 0;
      const poolB = Number(b.pool) || 0;
      return poolB - poolA;
    });
    
    return new Set(sorted.slice(0, 4).map(o => o.id));
  }, [outcomes, isMultiOutcome, selectedOutcomeId]);

  const chartOutcomesList = useMemo(() => {
    return outcomesList.filter(o => topOutcomeIds.has(o.id));
  }, [outcomesList, topOutcomeIds]);

  const { priceHistory, loading, error } = useMultiOutcomePriceHistory(marketId, outcomesList, timeframe);

  const timeframeOptions: Timeframe[] = ['1H', '4H', '1D', '1W', '1M'];
  const formatXAxisTick = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    if (timeframe === '1W' || timeframe === '1M') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getOutcomeName = (key: string) => {
    const slug = outcomeSlugById.get(key) || key;
    if (slug === 'home' || slug === 'yes') return homeTeamName;
    if (slug === 'away' || slug === 'no') return awayTeamName;
    if (slug === 'draw') return 'Draw';
    return outcomeLabelById.get(key) || outcomeLabelBySlug.get(slug) || slug;
  };

  const currentPricesFromPools = useMemo(() => {
    if (outcomes.length === 0) {
      return {};
    }

    const pricedOutcomes = calculateOdds(
      outcomes.map(outcome => ({
        id: outcome.id,
        label: outcome.label,
        pool: outcome.pool,
        outcome_slug: outcome.outcome_slug
      }))
    );

    if (pricedOutcomes.length === 0) {
      const fallback = outcomes.length > 0 ? 100 / outcomes.length : 0;
      return outcomes.reduce<{ [key: string]: number }>((acc, o) => {
        acc[o.id] = Math.round(fallback * 10) / 10;
        return acc;
      }, {});
    }

    const priceById = new Map(pricedOutcomes.map(outcome => [outcome.id, outcome.price]));
    const fallback = outcomes.length > 0 ? 100 / outcomes.length : 0;

    return outcomes.reduce<{ [key: string]: number }>((acc, o) => {
      const price = priceById.get(o.id);
      const percent = typeof price === 'number'
        ? Math.round(price * 1000) / 10
        : Math.round(fallback * 10) / 10;
      acc[o.id] = percent;
      return acc;
    }, {});
  }, [outcomes]);

  const currentPrices = useMemo(() => {
    if (priceHistory.length === 0) return currentPricesFromPools;
    const last = priceHistory[priceHistory.length - 1] as Record<string, number | string>;
    const prices: { [key: string]: number } = {};
    outcomesList.forEach(o => {
      const raw = last[o.id] ?? last[o.slug];
      prices[o.id] = typeof raw === 'number' ? raw : Number(raw || 0);
    });
    const hasValidPrices = Object.values(prices).some(p => p > 0);
    return hasValidPrices ? prices : currentPricesFromPools;
  }, [priceHistory, outcomesList, currentPricesFromPools]);

  // Fallback historia, ked nemame price_history
  const effectivePriceHistory = useMemo(() => {
    if (priceHistory.length > 0) return priceHistory;
    
    if (outcomesList.length === 0) return [];
    
    const now = new Date();
    const points: Array<{ time: string; [key: string]: number | string }> = [];
    
    for (let i = 9; i >= 0; i--) {
      const pointTime = new Date(now.getTime() - i * 6 * 60 * 1000);
      const point: { time: string; [key: string]: number | string } = {
        time: pointTime.toISOString()
      };
      outcomesList.forEach(o => {
        const poolPrice = currentPricesFromPools[o.id];
        point[o.id] = poolPrice && poolPrice > 0 ? poolPrice : (100 / outcomesList.length);
      });
      points.push(point);
    }
    
    return points;
  }, [priceHistory, outcomesList, currentPricesFromPools]);

  // Rozsah osi Y z dat
  const yAxisDomain = useMemo(() => {
    if (effectivePriceHistory.length === 0 || chartOutcomesList.length === 0) {
      return [0, 100];
    }
    
    let minValue = Infinity;
    let maxValue = -Infinity;
    
    effectivePriceHistory.forEach(point => {
      chartOutcomesList.forEach(o => {
        const value = Number(point[o.id] || 0);
        if (value > 0) {
          minValue = Math.min(minValue, value);
          maxValue = Math.max(maxValue, value);
        }
      });
    });
    
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return [0, 100];
    }
    
    const range = maxValue - minValue;
    const padding = Math.max(range * 0.15, 5);
    
    const domainMin = Math.max(0, Math.floor((minValue - padding) / 5) * 5);
    const domainMax = Math.min(100, Math.ceil((maxValue + padding) / 5) * 5);
    
    if (domainMax - domainMin < 10) {
      const mid = (domainMin + domainMax) / 2;
      return [Math.max(0, mid - 5), Math.min(100, mid + 5)];
    }
    
    return [domainMin, domainMax];
  }, [effectivePriceHistory, chartOutcomesList]);

  if (outcomes.length === 0) {
    return (
      <div className="w-full h-full min-h-[300px] bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Vyber zápas</p>
          <p className="text-sm opacity-70">pre zobrazenie grafu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px] bg-white rounded-lg p-4 flex flex-col border border-gray-200">
      
      {isSingleOutcomeView && chartOutcomesList.length > 0 && (
        <div className="mb-3">
          <div className="text-2xl font-bold text-green-600">
            {Math.round((currentPrices[chartOutcomesList[0].id] || 0) * 10) / 10}% chance
          </div>
        </div>
      )}
      
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {timeframeOptions.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      
      <div className="flex-1 relative min-h-[250px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm">Načítavam...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        ) : effectivePriceHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={effectivePriceHistory} margin={{ top: 20, right: 80, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#9ca3af"
                style={{ fontSize: '10px' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatXAxisTick}
              />
              <YAxis 
                stroke="#9ca3af"
                style={{ fontSize: '10px' }}
                tickLine={false}
                axisLine={false}
                domain={yAxisDomain}
                tickFormatter={(value) => `${Math.round(value)}%`}
                orientation="right"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  color: '#111827'
                }}
                formatter={(value, name) => {
                  const v = value ?? 0;
                  const n = typeof name === 'string' ? name : '';
                  return [`${v}%`, getOutcomeName(n)];
                }}
                labelFormatter={(label) => formatXAxisTick(String(label))}
                labelStyle={{ color: '#6b7280' }}
              />
              
              
              {chartOutcomesList.map((outcome) => (
                <Line
                  key={outcome.id}
                  type="monotone"
                  dataKey={outcome.id}
                  stroke={outcomeColorById.get(outcome.id) || '#8884d8'}
                  strokeWidth={2}
                  dot={false}
                  name={outcome.id}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Žiadna história</p>
              <p className="text-sm opacity-70">Zatiaľ neboli vykonané obchody</p>
            </div>
          </div>
        )}

        
        {chartOutcomesList.length > 0 && !isSingleOutcomeView && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            {isMultiOutcome && (
              <div className="text-[10px] text-gray-400 text-center mb-1">Top 4</div>
            )}
            {chartOutcomesList.map((outcome) => {
              const price = currentPrices[outcome.id] || 0;
              const color = outcomeColorById.get(outcome.id) || '#8884d8';
              return (
                <div 
                  key={outcome.id}
                  className="flex items-center gap-2 px-2 py-1 rounded border border-gray-100 bg-white/80"
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium" style={{ color }}>
                    {getOutcomeName(outcome.id)}
                  </span>
                  <span className="text-sm font-bold text-gray-900 ml-1">
                    {Math.round(price * 10) / 10}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
