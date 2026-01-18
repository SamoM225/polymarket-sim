'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { realtimeManager } from './realtimeManager';
import { Outcome } from '@/types';

// Realtime outcomes pre trh
export function useOutcomesRealtime(marketId: string | null | undefined) {
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelIdRef = useRef<string>(Math.random().toString(36).slice(2));

  const fetchOutcomes = useCallback(async () => {
    if (!marketId) {
      setOutcomes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('outcomes')
        .select('id, market_id, outcome_slug, label, pool, current_fee_rate')
        .eq('market_id', marketId);

      if (err) throw err;

      setOutcomes((data || []) as Outcome[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch outcomes';
      setError(errorMessage);
      console.error('❌ Error fetching outcomes:', err);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchOutcomes();
    }, 400);
  }, [fetchOutcomes]);

  useEffect(() => {
    fetchOutcomes();

    if (!marketId) return;

    const channelName = `outcomes:${marketId}:${channelIdRef.current}`;
    const unsubscribe = realtimeManager.subscribe(channelName, {
      table: 'outcomes',
      filter: `market_id=eq.${marketId}`,
      onInsert: (data: Outcome & { market_id?: string }) => {
        if (data.market_id !== marketId) return;
        
        setOutcomes(prev => {
          if (prev.some(o => o.id === data.id)) {
            return prev.map(o => o.id === data.id ? { ...o, ...data } : o);
          }
          return [...prev, data];
        });
        if (data.current_fee_rate === undefined) {
          scheduleRefresh();
        }
      },
      onUpdate: (data: Outcome & { market_id?: string }) => {
        setOutcomes(prev => {
          const existingOutcome = prev.find(o => o.id === data.id);
          if (!existingOutcome) {
            if (data.market_id && data.market_id !== marketId) {
              return prev;
            }
            return [...prev, data];
          }

          const newOutcomes = prev.map(o => {
            if (o.id === data.id) {
              return {
                ...o,
                pool: data.pool ?? o.pool,
                label: data.label ?? o.label,
                outcome_slug: data.outcome_slug ?? o.outcome_slug,
                current_fee_rate: data.current_fee_rate ?? o.current_fee_rate
              };
            }
            return o;
          });
          return newOutcomes;
        });
        if (data.current_fee_rate === undefined) {
          scheduleRefresh();
        }
      },
      onDelete: (data: Outcome & { market_id?: string }) => {
        if (data.market_id !== marketId) return;
        
        setOutcomes(prev => prev.filter(o => o.id !== data.id));
        scheduleRefresh();
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [marketId, fetchOutcomes, scheduleRefresh]);

  return { outcomes, loading, error, refetch: fetchOutcomes };
}

// Realtime detail trhu
export function useMarketRealtime(marketId: string | null | undefined) {
  const [market, setMarket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelIdRef = useRef<string>(Math.random().toString(36).slice(2));

  const fetchMarket = useCallback(async () => {
    if (!marketId) {
      setMarket(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('markets')
        .select('id, match_id, market_type, title, description, total_liquidity, status')
        .eq('id', marketId)
        .single();

      if (err) throw err;

      setMarket(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch market';
      setError(errorMessage);
      console.error('[useMarketRealtime] Error fetching market:', err);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchMarket();

    if (!marketId) return;

    const channelName = `markets:${marketId}:${channelIdRef.current}`;
    const unsubscribe = realtimeManager.subscribe(channelName, {
      table: 'markets',
      filter: `id=eq.${marketId}`,
      onInsert: (data: any) => {
        setMarket(data);
      },
      onUpdate: (data: any) => {
        setMarket(data);
      },
      onDelete: () => {
        setMarket(null);
      },
      onError: (err) => {
        setError(err.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [marketId, fetchMarket]);

  return { market, loading, error, refetch: fetchMarket };
}
