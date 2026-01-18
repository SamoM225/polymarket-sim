'use client';

import { Match, SupabaseMatch, MultiOutcomeMatchState, Outcome } from '../types';
import { TrendingUp } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { buildEffectiveOutcomePricing } from '@/utils/odds';
import { Region } from './Navbar';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/lib/NotificationContext';
import MultiOutcomePanel from './center-panel/MultiOutcomePanel';
import StandardMarketPanel from './center-panel/StandardMarketPanel';

interface CenterPanelProps {
  match: Match | null;
  supabaseMatch?: SupabaseMatch | null;
  realtimeOutcomes?: Outcome[];
  selectedOutcomeIds?: string[];
  activeOutcomeId?: string | null;
  onOutcomeSelectionChange?: (selectedOutcomeIds: string[], activeOutcomeId: string | null) => void;
  marketType?: string;
  betType?: 'yes' | 'no';
  onBetTypeChange?: (betType: 'yes' | 'no') => void;
  region?: Region;
}

type MarketCategory = 'BINARY' | '1X2' | 'MULTI';

function getMarketCategory(marketType: string | undefined, hasDraw: boolean): MarketCategory {
  const normalized = (marketType || '').toUpperCase();
  if (normalized.includes('MULTI')) return 'MULTI';
  if (normalized.includes('BINARY') || normalized === 'BIN') return 'BINARY';
  if (normalized === '1X2' || hasDraw) return '1X2';
  return 'BINARY';
}

export default function CenterPanel({
  match,
  supabaseMatch,
  realtimeOutcomes,
  selectedOutcomeIds = [],
  activeOutcomeId = null,
  onOutcomeSelectionChange,
  marketType,
  betType = 'yes',
  onBetTypeChange,
  region = 'EU'
}: CenterPanelProps) {
  const [activeTab, setActiveTab] = useState<'chart' | 'orderbook'>('chart');
  const [unlocking, setUnlocking] = useState(false);
  const [fallbackMarketId, setFallbackMarketId] = useState<string | null>(null);
  const [fallbackOutcomes, setFallbackOutcomes] = useState<Outcome[]>([]);
  const { notify } = useNotification();

  const market = supabaseMatch?.markets?.[0];
  const marketId = market?.id;
  const isMarketLocked = market?.status ? market.status !== 'OPEN' : false;
  
  const effectiveMarketType = marketType || market?.type || match?.marketType;
  const hasDraw = match?.league?.hasDraw ?? false;
  const category = getMarketCategory(effectiveMarketType, hasDraw);

  const liquidityDisplay = useMemo(() => {
    const liquidity = market?.liquidity_usdc;
    if (liquidity === null || liquidity === undefined || Number.isNaN(liquidity)) return '--';
    if (liquidity >= 1_000_000) return `$${(liquidity / 1_000_000).toFixed(2)}M`;
    if (liquidity >= 1_000) return `$${(liquidity / 1_000).toFixed(2)}k`;
    return `$${liquidity.toFixed(2)}`;
  }, [market?.liquidity_usdc]);

  const baseOutcomes = (realtimeOutcomes && realtimeOutcomes.length > 0)
    ? realtimeOutcomes
    : (market?.outcomes || []);
  const outcomes = baseOutcomes.length > 0 ? baseOutcomes : fallbackOutcomes;
  const chartMarketId = fallbackMarketId ?? marketId;

  const { pricedOutcomes, effectiveById, normalizedById, totalEffective } = useMemo(() => {
    if (!outcomes || outcomes.length === 0) {
      return { pricedOutcomes: [], effectiveById: new Map(), normalizedById: new Map(), totalEffective: 0 };
    }
    return buildEffectiveOutcomePricing(outcomes);
  }, [outcomes]);

  useEffect(() => {
    if (!supabaseMatch?.id) {
      setFallbackMarketId(null);
      setFallbackOutcomes([]);
      return;
    }

    let isActive = true;
    const fetchFallback = async () => {
      try {
        const { data, error } = await supabase
          .from('markets')
          .select('id, type, outcomes (id, outcome_slug, label, pool, current_fee_rate)')
          .eq('match_id', supabaseMatch.id);

        if (error) throw error;

        const markets = (data || []) as Array<{
          id: string;
          type?: string | null;
          outcomes?: Outcome[];
        }>;

        const preferred = markets.find(m => m.id === marketId && m.outcomes && m.outcomes.length > 0)
          || markets.find(m => m.outcomes && m.outcomes.length > 0)
          || markets[0];

        if (isActive) {
          setFallbackMarketId(preferred?.id ?? null);
          setFallbackOutcomes(preferred?.outcomes || []);
        }
      } catch (err) {
        console.error('Failed to load fallback outcomes:', err);
      }
    };

    fetchFallback();
    return () => { isActive = false; };
  }, [supabaseMatch?.id, marketId]);

  const handleUnlockMarket = async () => {
    if (!supabaseMatch?.id) {
      notify('Match not available', 'error');
      return;
    }
    setUnlocking(true);
    try {
      const { data, error } = await supabase.rpc('unlock_market', { p_match_id: supabaseMatch.id });
      if (error) throw error;
      notify(data?.message || 'Market unlocked', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to unlock market', 'error');
    } finally {
      setUnlocking(false);
    }
  };

  const handleSelectOutcome = (outcomeId: string) => {
    if (!onOutcomeSelectionChange) return;
    if (activeOutcomeId === outcomeId) {
      onOutcomeSelectionChange([], null);
    } else {
      onOutcomeSelectionChange([outcomeId], outcomeId);
    }
  };

  const handleSelectOutcomeWithBetType = (outcomeId: string, nextBetType: 'yes' | 'no') => {
    if (!onOutcomeSelectionChange) return;
    onOutcomeSelectionChange([outcomeId], outcomeId);
    onBetTypeChange?.(nextBetType);
  };

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white text-gray-400">
        <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Select a match to view details</p>
      </div>
    );
  }

  const matchState = supabaseMatch?.match_state as MultiOutcomeMatchState | null;

  const positionById = new Map<string, number>();
  (matchState?.positions || []).forEach((outcomeId, idx) => {
    positionById.set(outcomeId, idx + 1);
  });

  const baseProbability = outcomes.length > 0 ? 1 / outcomes.length : 0.33;
  const displayOutcomes = pricedOutcomes.length > 0
    ? pricedOutcomes
    : outcomes.map(outcome => ({
        id: outcome.id,
        label: outcome.label,
        outcome_slug: outcome.outcome_slug,
        price: baseProbability
      }));

  const getOutcomeBySlug = (slug: string) => displayOutcomes.find(o => o.outcome_slug === slug);
  
  const getOutcomeLabel = (outcome?: { outcome_slug?: string; label?: string } | null): string => {
    if (!outcome) return '';
    if (outcome.outcome_slug === 'home') return match.homeTeam.name;
    if (outcome.outcome_slug === 'away') return match.awayTeam.name;
    if (outcome.outcome_slug === 'draw') return 'Draw';
    return outcome.label || outcome.outcome_slug || '';
  };

  const sortedMultiOutcomes = [...displayOutcomes].sort((a, b) => {
    const posA = positionById.get(a.id);
    const posB = positionById.get(b.id);
    if (posA !== undefined && posB !== undefined) return posA - posB;
    if (posA !== undefined) return -1;
    if (posB !== undefined) return 1;
    return b.price - a.price;
  });

  const activeOutcome = outcomes.find(o => o.id === activeOutcomeId)
    || outcomes.find(o => selectedOutcomeIds.includes(o.id))
    || outcomes[0];

  if (category === 'MULTI') {
    return (
      <MultiOutcomePanel
        match={match}
        supabaseMatch={supabaseMatch}
        outcomes={outcomes}
        chartMarketId={chartMarketId || null}
        liquidityDisplay={liquidityDisplay}
        displayOutcomes={displayOutcomes}
        sortedOutcomes={sortedMultiOutcomes}
        positionById={positionById}
        matchState={matchState}
        activeOutcome={activeOutcome}
        activeOutcomeId={activeOutcomeId}
        betType={betType}
        region={region}
        isMarketLocked={isMarketLocked}
        unlocking={unlocking}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onUnlockMarket={handleUnlockMarket}
        onSelectOutcome={handleSelectOutcome}
        onSelectOutcomeWithBetType={handleSelectOutcomeWithBetType}
        effectiveById={effectiveById}
        normalizedById={normalizedById}
        totalEffective={totalEffective}
      />
    );
  }

  const homeOutcome = getOutcomeBySlug('home') || getOutcomeBySlug('yes') || displayOutcomes[0];
  const awayOutcome = getOutcomeBySlug('away') || getOutcomeBySlug('no') || displayOutcomes[1];
  const drawOutcome = category === '1X2' ? getOutcomeBySlug('draw') : null;

  return (
    <StandardMarketPanel
      match={match}
      category={category}
      region={region}
      liquidityDisplay={liquidityDisplay}
      isMarketLocked={isMarketLocked}
      unlocking={unlocking}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onUnlockMarket={handleUnlockMarket}
      selectedOutcomeIds={selectedOutcomeIds}
      outcomes={outcomes}
      displayOutcomes={displayOutcomes}
      homeOutcome={homeOutcome}
      awayOutcome={awayOutcome}
      drawOutcome={drawOutcome}
      activeOutcome={activeOutcome}
      chartMarketId={chartMarketId || null}
      getOutcomeLabel={getOutcomeLabel}
      onSelectOutcome={handleSelectOutcome}
      effectiveById={effectiveById}
    />
  );
}
