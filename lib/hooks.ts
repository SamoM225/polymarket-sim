'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { realtimeManager } from './realtimeManager';
import { SupabaseMatch, Position, Profile, Outcome, Market } from '@/types';
import { useAuth } from './AuthContext';

type PriceHistoryRow = {
  outcome_id: string;
  price: number;
  time: string;
};

const PRICE_HISTORY_TIME_COLUMNS = ['created_at'] as const;
const PRICE_HISTORY_OUTCOME_COLUMNS = ['outcome_id'] as const;

const normalizeTimestamp = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  let normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  normalized = normalized.replace(/\+00(?::?00)?$/, 'Z');
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString();
};

const extractPriceHistoryTimestamp = (row: Record<string, unknown>): string => {
  for (const timeCol of PRICE_HISTORY_TIME_COLUMNS) {
    const raw = row[timeCol];
    if (raw !== null && raw !== undefined) {
      const normalized = normalizeTimestamp(String(raw));
      if (normalized) return normalized;
    }
  }
  return '';
};

const extractPriceHistoryOutcomeId = (row: Record<string, unknown>): string => {
  for (const outcomeCol of PRICE_HISTORY_OUTCOME_COLUMNS) {
    const raw = row[outcomeCol];
    if (raw !== null && raw !== undefined) {
      const value = String(raw);
      if (value) return value;
    }
  }
  return '';
};

// Cache stlpcov pre price_history
const columnCache = new Map<string, { timeCol: string; outcomeCol: string }>();

// Nacita price history s automatickou detekciou stlpcov
async function fetchPriceHistoryRows(
  marketId: string,
  startTime: string,
  outcomeId?: string,
  limit = 500
): Promise<PriceHistoryRow[]> {
  const cached = columnCache.get(marketId);
  if (cached) {
    const query = supabase
      .from('price_history')
      .select(`${cached.timeCol}, price, ${cached.outcomeCol}`)
      .eq('market_id', marketId)
      .gte(cached.timeCol, startTime)
      .order(cached.timeCol, { ascending: false })
      .limit(limit);
    
    if (outcomeId) {
      query.eq(cached.outcomeCol, outcomeId);
    }
    
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return (data as unknown as Array<Record<string, string | number | null>>)
        .map(row => ({
          time: normalizeTimestamp(String(row[cached.timeCol] ?? '')),
          price: Number(row.price || 0),
          outcome_id: String(row[cached.outcomeCol] || '')
        }))
        .filter(row => row.time && row.outcome_id);
    }
  }

  for (const column of PRICE_HISTORY_TIME_COLUMNS) {
    for (const outcomeColumn of PRICE_HISTORY_OUTCOME_COLUMNS) {
      let query = supabase
        .from('price_history')
        .select(`${column}, price, ${outcomeColumn}`)
        .eq('market_id', marketId)
        .limit(limit);

      if (outcomeId) {
        query = query.eq(outcomeColumn, outcomeId);
      }

      if (startTime) {
        query = query.gte(column, startTime);
      }

      const { data, error } = await query.order(column, { ascending: false });
      if (!error && data && data.length > 0) {
        columnCache.set(marketId, { timeCol: column, outcomeCol: outcomeColumn });
        
        return (data as unknown as Array<Record<string, string | number | null>>)
          .map(row => ({
            time: normalizeTimestamp(String(row[column] ?? '')),
            price: Number(row.price || 0),
            outcome_id: String(row[outcomeColumn] || '')
          }))
          .filter(row => row.time && row.outcome_id);
      }
    }
  }

  return [];
}

const getBucketMinutes = (timeframe: '1H' | '4H' | '1D' | '1W' | '1M') => {
  switch (timeframe) {
    case '1H':
      return 1;
    case '4H':
      return 1;
    case '1D':
      return 10;
    case '1W':
      return 60;
    case '1M':
      return 240;
    default:
      return 10;
  }
};

const buildBucketRange = (hoursBack: number, bucketMinutes: number) => {
  const bucketMs = bucketMinutes * 60 * 1000;
  const now = new Date();
  const endMs = Math.floor(now.getTime() / bucketMs) * bucketMs;
  const pointsCount = Math.max(1, Math.round((hoursBack * 60) / bucketMinutes));
  const startMs = endMs - (pointsCount - 1) * bucketMs;
  const bucketTimes = Array.from({ length: pointsCount }, (_, i) => new Date(startMs + i * bucketMs));

  return {
    startTime: new Date(startMs).toISOString(),
    bucketTimes,
    bucketMs
  };
};

// Zoznam zapasov s realtime update
export function useMatches(options?: { enableRealtime?: boolean; enableOutcomesRealtime?: boolean }) {
  const { enableRealtime = true, enableOutcomesRealtime = false } = options || {};
  const [matches, setMatches] = useState<SupabaseMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: err } = await supabase
        .from('matches')
        .select(`
          id, title, start_time, home_team, away_team, sport, status, home_goals, away_goals, simulation_minute, match_state, ai_response,
          markets (
            id, type, liquidity_usdc, status, risk_multiplier,
            outcomes (id, outcome_slug, label, pool, current_fee_rate)
          )
        `)
        .order('start_time', { ascending: true });

      if (err) {
        throw err;
      }

      setMatches((data || []) as SupabaseMatch[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch matches';
      setError(errorMessage);
      console.error('❌ Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();

    if (!enableRealtime) {
      return;
    }

    const unsubscribe = realtimeManager.subscribe('matches-realtime', {
      table: 'matches',
      onInsert: (data: SupabaseMatch) => {
        fetchMatches();
      },
      onUpdate: (data: SupabaseMatch) => {
        setMatches(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
      },
      onDelete: (data: SupabaseMatch) => {
        setMatches(prev => prev.filter(m => m.id !== data.id));
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    const unsubscribeMarkets = realtimeManager.subscribe('markets-realtime', {
      table: 'markets',
      onInsert: (market: Market & { match_id: string }) => {
        setMatches(prev => prev.map(match => {
          if (match.id === market.match_id) {
            return {
              ...match,
              markets: [...(match.markets || []), { ...market, outcomes: [] }]
            };
          }
          return match;
        }));
      },
      onUpdate: (market: Market & { match_id: string }) => {
        setMatches(prev => prev.map(match => ({
          ...match,
          markets: (match.markets || []).map(m => 
            m.id === market.id 
              ? { 
                  ...m, 
                  liquidity_usdc: market.liquidity_usdc, 
                  status: market.status, 
                  risk_multiplier: market.risk_multiplier ?? m.risk_multiplier 
                }
              : m
          )
        })));
      },
      onDelete: (market: Market & { match_id: string }) => {
        setMatches(prev => prev.map(match => ({
          ...match,
          markets: (match.markets || []).filter(m => m.id !== market.id)
        })));
      },
    });

    const unsubscribeOutcomes = enableOutcomesRealtime
      ? realtimeManager.subscribe('outcomes-realtime', {
          table: 'outcomes',
          onInsert: (outcome: Outcome & { market_id: string }) => {
            setMatches(prev => prev.map(match => ({
              ...match,
              markets: (match.markets || []).map(market => {
                if (market.id === outcome.market_id) {
                  return {
                    ...market,
                    outcomes: [...(market.outcomes || []), outcome]
                  };
                }
                return market;
              })
            })));
          },
          onUpdate: (outcome: Outcome & { market_id: string }) => {
            setMatches(prev => prev.map(match => ({
              ...match,
              markets: (match.markets || []).map(market => ({
                ...market,
                outcomes: (market.outcomes || []).map(o => 
                  o.id === outcome.id 
                    ? {
                        ...o,
                        pool: outcome.pool,
                        label: outcome.label,
                        current_fee_rate: outcome.current_fee_rate ?? o.current_fee_rate,
                        outcome_slug: outcome.outcome_slug ?? o.outcome_slug
                      }
                    : o
                )
              }))
            })));
          },
          onDelete: (outcome: Outcome & { market_id: string }) => {
            setMatches(prev => prev.map(match => ({
              ...match,
              markets: (match.markets || []).map(market => ({
                ...market,
                outcomes: (market.outcomes || []).filter(o => o.id !== outcome.id)
              }))
            })));
          },
        })
      : () => Promise.resolve();

    return () => {
      unsubscribe();
      unsubscribeMarkets();
      unsubscribeOutcomes();
    };
  }, [fetchMatches, enableRealtime, enableOutcomesRealtime]);

  return { matches, loading, error, refetch: fetchMatches };
}

// Profil a zostatok usera
export function useUserPortfolio() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef<string>(Math.random().toString(36).slice(2));

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (err) throw err;

      setProfile(data as Profile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch portfolio';
      setError(errorMessage);
      console.error('❌ Error fetching portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    fetchProfile();

    const channelName = `profile:${user.id}:${channelIdRef.current}`;
    const unsubscribe = realtimeManager.subscribe(channelName, {
      table: 'profiles',
      filter: `id=eq.${user.id}`,
      onUpdate: (data: Profile & { id?: string }) => {
        
        if (data.id && data.id !== user.id) {
          return;
        }
        
        setProfile(prev => prev ? { ...prev, usdc_balance: data.usdc_balance ?? prev.usdc_balance } : data);
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}

// Pozicie usera
export function usePositions() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef<string>(Math.random().toString(36).slice(2));

  const fetchPositions = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('positions')
        .select(`
          *,
          outcomes (label, outcome_slug, pool),
          markets (id, type, status, matches (title)) 
        `)
        .eq('user_id', user.id);

      if (err) throw err;

      setPositions((data || []) as Position[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
      setError(errorMessage);
      console.error('❌ Error fetching positions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPositionWithNested = useCallback(async (positionId: string): Promise<Position | null> => {
    const { data, error: err } = await supabase
      .from('positions')
      .select(`
        *,
        outcomes (label, outcome_slug, pool),
        markets (id, type, status, matches (title)) 
      `)
      .eq('id', positionId)
      .single();
    
    if (err) {
      console.error('❌ Error fetching position with nested:', err);
      return null;
    }
    return data as Position;
  }, []);

  useEffect(() => {
    if (!user) {
      setPositions([]);
      return;
    }

    fetchPositions();

    const channelName = `positions:${user.id}:${channelIdRef.current}`;
    const unsubscribe = realtimeManager.subscribe(channelName, {
      table: 'positions',
      filter: `user_id=eq.${user.id}`,
      onInsert: async (data: Position & { user_id?: string }) => {
        if (data.user_id !== user.id) return;
        
        const fullPosition = await fetchPositionWithNested(data.id);
        if (fullPosition) {
          setPositions(prev => {
            if (prev.some(p => p.id === fullPosition.id)) {
              return prev.map(p => p.id === fullPosition.id ? fullPosition : p);
            }
            return [...prev, fullPosition];
          });
        }
      },
      onUpdate: async (data: Position & { user_id?: string }) => {
        
        setPositions(prev => {
          const existingPosition = prev.find(p => p.id === data.id);
          if (!existingPosition) {
            fetchPositionWithNested(data.id).then(fullPosition => {
              if (!fullPosition) return;
              setPositions(prev => {
                if (prev.some(p => p.id === fullPosition.id)) {
                  return prev.map(p => p.id === fullPosition.id ? fullPosition : p);
                }
                return [...prev, fullPosition];
              });
            });
            return prev;
          }
          
          
          if (data.shares !== undefined && data.shares <= 0) {
            const newPositions = prev.filter(p => p.id !== data.id);
            return newPositions;
          }
          
          const newPositions = prev.map(p => {
            if (p.id === data.id) {
              return {
                ...p,
                shares: data.shares ?? p.shares,
                amount_spent: data.amount_spent ?? p.amount_spent,
                avg_price: data.avg_price ?? p.avg_price
              };
            }
            return p;
          });
          return newPositions;
        });
      },
      onDelete: (data: Position & { user_id?: string }) => {
        
        setPositions(prev => {
          const existingPosition = prev.find(p => p.id === data.id);
          if (!existingPosition) {
            return prev;
          }
          
          const newPositions = prev.filter(p => p.id !== data.id);
          return newPositions;
        });
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, fetchPositions, fetchPositionWithNested]);

  return { positions, loading, error, refetch: fetchPositions };
}

// Historia ceny pre jeden outcome
export function usePriceHistory(marketId: string | null, outcomeId: string | null, timeframe: '1H' | '4H' | '1D' | '1W' | '1M' = '1D') {
  const [priceHistory, setPriceHistory] = useState<Array<{ time: string; price: number; volume: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!marketId || !outcomeId) return;
    
    hasFetchedRef.current = false;
    
    const fetchPriceHistory = async () => {
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;
      
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        let hoursBack = 24;

        if (timeframe === '1H') hoursBack = 1;
        else if (timeframe === '4H') hoursBack = 4;
        else if (timeframe === '1W') hoursBack = 7 * 24;
        else if (timeframe === '1M') hoursBack = 30 * 24;

        const bucketMinutes = getBucketMinutes(timeframe);
        const { startTime, bucketTimes, bucketMs } = buildBucketRange(hoursBack, bucketMinutes);

        const maxRows = Math.min(5000, Math.max(500, bucketTimes.length * 6));
        const rows = await fetchPriceHistoryRows(marketId, startTime, outcomeId, maxRows);
        const sortedRows = [...rows].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        const buckets = new Map<string, number>();

        sortedRows.forEach(row => {
          const date = new Date(row.time);
          const bucketTime = new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
          const key = bucketTime.toISOString();
          buckets.set(key, row.price);
        });

        let lastPrice = 0;
        const history = bucketTimes.map(bucketTime => {
          const key = bucketTime.toISOString();
          if (buckets.has(key)) {
            lastPrice = buckets.get(key) ?? lastPrice;
          }
          return {
            time: key,
            price: lastPrice,
            volume: 0,
          };
        });

        setPriceHistory(history);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch price history';
        setError(errorMessage);
        console.error('❌ Error fetching price history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistory();

    const unsubscribe = realtimeManager.subscribe(`price-${marketId}-${outcomeId}`, {
      table: 'price_history',
      filter: `market_id=eq.${marketId}`,
      onInsert: (data: Record<string, unknown>) => {
        const rowOutcomeId = extractPriceHistoryOutcomeId(data);
        if (rowOutcomeId === outcomeId) {
          const priceValue = Number(data.price || 0);
          const timestamp = extractPriceHistoryTimestamp(data);
          if (!timestamp) return;

          const bucketMinutes = getBucketMinutes(timeframe);
          const date = new Date(timestamp);
          const bucketTime = new Date(Math.floor(date.getTime() / (bucketMinutes * 60 * 1000)) * (bucketMinutes * 60 * 1000));
          const bucketTimeStr = bucketTime.toISOString();

          setPriceHistory(prev => {
            const foundBucket = prev.find(h => h.time === bucketTimeStr);

            if (foundBucket) {
              return prev.map(h => {
                if (h.time === bucketTimeStr) {
                  return { ...h, price: priceValue, volume: h.volume };
                }
                return h;
              });
            }
            return [
              ...prev,
              { time: bucketTimeStr, price: priceValue, volume: 0 }
            ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          });
        }
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [marketId, outcomeId, timeframe]);

  return { priceHistory, loading, error };
}

// Historia cien pre viac outcomes
export function useMultiOutcomePriceHistory(
  marketId: string | null, 
  outcomes: Array<{ id: string; label: string; slug: string }>,
  timeframe: '1H' | '4H' | '1D' | '1W' | '1M' = '1D'
) {
  const [priceHistory, setPriceHistory] = useState<Array<{
    time: string;
    [key: string]: number | string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outcomesKey = outcomes.map(o => o.id).sort().join(',');
  const outcomesRef = useRef(outcomes);
  outcomesRef.current = outcomes;
  const lastKnownRef = useRef<Record<string, number>>({});

  const fetchAllPriceHistory = useCallback(async () => {
    if (!marketId || outcomesRef.current.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      let hoursBack = 24;

      if (timeframe === '1H') hoursBack = 1;
      else if (timeframe === '4H') hoursBack = 4;
      else if (timeframe === '1W') hoursBack = 7 * 24;
      else if (timeframe === '1M') hoursBack = 30 * 24;

      const bucketMinutes = getBucketMinutes(timeframe);
      const { startTime, bucketTimes, bucketMs } = buildBucketRange(hoursBack, bucketMinutes);

      const currentOutcomes = outcomesRef.current;
      const maxRows = Math.min(10000, Math.max(500, bucketTimes.length * currentOutcomes.length * 6));
      const rows = await fetchPriceHistoryRows(marketId, startTime, undefined, maxRows);
      const sortedRows = [...rows].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      const buckets = new Map<string, { [outcomeId: string]: number }>();

      sortedRows.forEach(row => {
        const date = new Date(row.time);
        const bucketTime = new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
        const key = bucketTime.toISOString();

        if (!buckets.has(key)) {
          buckets.set(key, {});
        }
        const bucket = buckets.get(key)!;
        bucket[row.outcome_id] = row.price;
      });

      const initialProbability = currentOutcomes.length > 0 ? 1 / currentOutcomes.length : 0;
      const lastKnown: Record<string, number> = {};
      currentOutcomes.forEach(outcome => {
        lastKnown[outcome.id] = initialProbability;
      });

      const history = bucketTimes.map(bucketTime => {
        const outcomeData = buckets.get(bucketTime.toISOString()) || {};

        currentOutcomes.forEach(outcome => {
          const latest = outcomeData[outcome.id];
          if (latest !== undefined) {
            lastKnown[outcome.id] = latest;
          }
        });

        let total = 0;
        currentOutcomes.forEach(outcome => {
          total += lastKnown[outcome.id];
        });
        if (total <= 0) {
          const fallback = currentOutcomes.length > 0 ? 1 / currentOutcomes.length : 0;
          currentOutcomes.forEach(outcome => {
            lastKnown[outcome.id] = fallback;
          });
          total = fallback * currentOutcomes.length;
        }

        const point: { time: string; [key: string]: number | string } = {
          time: bucketTime.toISOString()
        };

        let running = 0;
        currentOutcomes.forEach((outcome, index) => {
          const rawPercent = (lastKnown[outcome.id] / total) * 100;
          if (index === currentOutcomes.length - 1) {
            const value = Math.max(0, Math.round((100 - running) * 10) / 10);
            point[outcome.slug] = value;
            point[outcome.id] = value;
            return;
          }
          const rounded = Math.round(rawPercent * 10) / 10;
          point[outcome.slug] = rounded;
          point[outcome.id] = rounded;
          running += rounded;
        });

        return point;
      });

      setPriceHistory(history);
      lastKnownRef.current = lastKnown;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch price history';
      setError(errorMessage);
      console.error('Error fetching multi-outcome price history:', err);
    } finally {
      setLoading(false);
    }
  }, [marketId, timeframe]);

  useEffect(() => {
    if (!marketId || outcomes.length === 0) {
      setPriceHistory([]);
      setLoading(false);
      setError(null);
      return;
    }

    const initialProbability = outcomes.length > 0 ? 1 / outcomes.length : 0;
    lastKnownRef.current = outcomes.reduce<Record<string, number>>((acc, outcome) => {
      acc[outcome.id] = initialProbability;
      return acc;
    }, {});

    fetchAllPriceHistory();

    const unsubscribe = realtimeManager.subscribe(`multi-price-${marketId}`, {
      table: 'price_history',
      filter: `market_id=eq.${marketId}`,
      onInsert: (data: Record<string, unknown>) => {
        const bucketMinutes = getBucketMinutes(timeframe);
        const timestamp = extractPriceHistoryTimestamp(data);
        if (!timestamp) return;

        const date = new Date(timestamp);
        const bucketTime = new Date(Math.floor(date.getTime() / (bucketMinutes * 60 * 1000)) * (bucketMinutes * 60 * 1000));
        const bucketTimeStr = new Date(bucketTime).toISOString();

        const currentOutcomes = outcomesRef.current;
        const rowOutcomeId = extractPriceHistoryOutcomeId(data);
        if (!rowOutcomeId || !currentOutcomes.some(o => o.id === rowOutcomeId)) return;

        const lastKnown = lastKnownRef.current;
        const priceValue = Number(data.price || 0);
        lastKnown[rowOutcomeId] = priceValue;

        let total = 0;
        currentOutcomes.forEach(outcome => {
          total += lastKnown[outcome.id] ?? 0;
        });
        if (total <= 0) {
          const fallback = currentOutcomes.length > 0 ? 1 / currentOutcomes.length : 0;
          currentOutcomes.forEach(outcome => {
            lastKnown[outcome.id] = fallback;
          });
          total = fallback * currentOutcomes.length;
        }

        const normalized: Record<string, number> = {};
        let running = 0;
        currentOutcomes.forEach((outcome, index) => {
          const rawPercent = ((lastKnown[outcome.id] ?? 0) / total) * 100;
          if (index === currentOutcomes.length - 1) {
            const value = Math.max(0, Math.round((100 - running) * 10) / 10);
            normalized[outcome.slug] = value;
            normalized[outcome.id] = value;
            return;
          }
          const rounded = Math.round(rawPercent * 10) / 10;
          normalized[outcome.slug] = rounded;
          normalized[outcome.id] = rounded;
          running += rounded;
        });

        setPriceHistory(prev => {
          const foundBucket = prev.find(h => h.time === bucketTimeStr);
          if (foundBucket) {
            return prev.map(h => h.time === bucketTimeStr ? { ...h, ...normalized } : h);
          }

          const newBucket: { time: string; [key: string]: number | string } = { time: bucketTimeStr, ...normalized };
          return [...prev, newBucket].sort((a, b) => {
            return new Date(a.time).getTime() - new Date(b.time).getTime();
          });
        });
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    return () => {
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, outcomesKey, timeframe]);

  return { priceHistory, loading, error };
}

export function useOrderBook(marketId: string | null, outcomeId: string | null) {
  const [bids, setBids] = useState<Array<{ price: number; size: number }>>([]);
  const [asks, setAsks] = useState<Array<{ price: number; size: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bidsRef = useRef<Array<{ price: number; size: number }>>([]);
  const asksRef = useRef<Array<{ price: number; size: number }>>([]);

  useEffect(() => {
    bidsRef.current = bids;
  }, [bids]);

  useEffect(() => {
    asksRef.current = asks;
  }, [asks]);

  const fetchOrderBook = useCallback(async () => {
    if (!marketId || !outcomeId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: trades, error: err } = await supabase
        .from('trades')
        .select('price, shares, side')
        .eq('market_id', marketId)
        .eq('outcome_id', outcomeId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (err) throw err;

      const bidMap = new Map<number, number>();
      const askMap = new Map<number, number>();

      (trades || []).forEach(trade => {
        const priceRounded = Math.round(trade.price * 100) / 100;

        if (trade.side === 'buy') {
          bidMap.set(priceRounded, (bidMap.get(priceRounded) || 0) + trade.shares);
        } else {
          askMap.set(priceRounded, (askMap.get(priceRounded) || 0) + trade.shares);
        }
      });

      const bidArray = Array.from(bidMap.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => b.price - a.price);

      const askArray = Array.from(askMap.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => a.price - b.price);

      setBids(bidArray);
      setAsks(askArray);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch order book';
      setError(errorMessage);
      console.error('❌ Error fetching order book:', err);
    } finally {
      setLoading(false);
    }
  }, [marketId, outcomeId]);

  const aggregateTrade = useCallback((newTrade: { price: number; shares: number; side: 'buy' | 'sell' }, currentBids: Array<{ price: number; size: number }>, currentAsks: Array<{ price: number; size: number }>) => {
    const priceRounded = Math.round(newTrade.price * 100) / 100;

    if (newTrade.side === 'buy') {
      const existingBid = currentBids.find(b => b.price === priceRounded);
      if (existingBid) {
        return {
          bids: currentBids.map(b => b.price === priceRounded ? { ...b, size: b.size + newTrade.shares } : b),
          asks: currentAsks
        };
      } else {
        return {
          bids: [...currentBids, { price: priceRounded, size: newTrade.shares }].sort((a, b) => b.price - a.price),
          asks: currentAsks
        };
      }
    } else {
      const existingAsk = currentAsks.find(a => a.price === priceRounded);
      if (existingAsk) {
        return {
          bids: currentBids,
          asks: currentAsks.map(a => a.price === priceRounded ? { ...a, size: a.size + newTrade.shares } : a)
        };
      } else {
        return {
          bids: currentBids,
          asks: [...currentAsks, { price: priceRounded, size: newTrade.shares }].sort((a, b) => a.price - b.price)
        };
      }
    }
  }, []);

  useEffect(() => {
    if (!marketId || !outcomeId) return;

    fetchOrderBook();

    const unsubscribe = realtimeManager.subscribe(`orderbook-${marketId}-${outcomeId}`, {
      table: 'trades',
      filter: `market_id=eq.${marketId}`,
      onInsert: (data: { outcome_id: string; price: number; shares: number; side: 'buy' | 'sell' }) => {
        if (data.outcome_id === outcomeId) {
          const { bids: newBids, asks: newAsks } = aggregateTrade(data, bidsRef.current, asksRef.current);
          bidsRef.current = newBids;
          asksRef.current = newAsks;
          setBids(newBids);
          setAsks(newAsks);
        }
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [marketId, outcomeId, fetchOrderBook, aggregateTrade]);

  return { bids, asks, loading, error };
}
