'use client';

import { useState, useMemo, useEffect } from 'react';
import Navbar, { Region } from '@/components/Navbar';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import { Match, SupabaseMatch, Outcome, MultiOutcomeMatchState } from '@/types';
import { useMatches } from '@/lib/hooks';
import { useOutcomesRealtime } from '@/lib/realtimeHooks';
import { isSameDay, parseISO } from 'date-fns';
import { buildEffectiveOutcomePricing } from '@/utils/odds';

const resolveMarketType = (marketType: string | null | undefined, outcomes: Outcome[]) => {
  const normalized = (marketType || '').toUpperCase();
  if (normalized.includes('1X2')) return '1X2';
  if (normalized.includes('BINARY')) return 'BINARY';
  if (normalized.includes('MULTI')) return 'MULTI';

  const slugs = outcomes.map(outcome => outcome.outcome_slug?.toLowerCase());
  const hasHome = slugs.includes('home');
  const hasAway = slugs.includes('away');
  const hasDraw = slugs.includes('draw');
  const hasYes = slugs.includes('yes');
  const hasNo = slugs.includes('no');

  if (hasHome && hasAway && hasDraw) return '1X2';
  if (outcomes.length === 2 || (hasYes && hasNo)) return 'BINARY';
  if (outcomes.length > 2) return 'MULTI';
  return 'BINARY';
};

export default function Home() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedOutcomeIds, setSelectedOutcomeIds] = useState<string[]>([]);
  const [activeOutcomeId, setActiveOutcomeId] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [betType, setBetType] = useState<'yes' | 'no'>('yes');
  
  const [region, setRegion] = useState<Region>('EU');

  const { matches: supabaseMatches } = useMatches({ 
    enableRealtime: Boolean(selectedMatchId),
    enableOutcomesRealtime: false,
    pollIntervalMs: 60000,
    realtimeMatchId: selectedMatchId
  });
  const selectedSupabaseMatchRaw = useMemo(() => {
    if (!selectedMatchId) return null;
    return supabaseMatches.find(match => match.id === selectedMatchId) || null;
  }, [supabaseMatches, selectedMatchId]);
  const selectedMarketId = selectedSupabaseMatchRaw?.markets?.[0]?.id ?? null;
  const { outcomes: selectedOutcomes } = useOutcomesRealtime(selectedMarketId);
  const selectedOutcomesForMarket = useMemo(() => {
    if (!selectedMarketId || selectedOutcomes.length === 0) return [];
    const outcomeMarketId = selectedOutcomes.find(outcome => outcome.market_id)?.market_id;
    if (outcomeMarketId && outcomeMarketId !== selectedMarketId) return [];
    return selectedOutcomes;
  }, [selectedMarketId, selectedOutcomes]);

  const convertSupabaseMatch = (supabaseMatch: SupabaseMatch): Match => {
    const [titleHome, titleAway] = supabaseMatch.title.split(' vs ').map(t => t.trim());
    const homeTeamName = supabaseMatch.home_team || titleHome || 'Home';
    const awayTeamName = supabaseMatch.away_team || titleAway || 'Away';
    
    const market = supabaseMatch.markets?.[0];
    const outcomes = market?.outcomes || [];
    const marketType = resolveMarketType(market?.type ?? null, outcomes);
    
    const { pricedOutcomes, effectiveById } = buildEffectiveOutcomePricing(outcomes);
    const applyFee = (price: number, outcomeId?: string) => {
      if (!outcomeId) return price;
      return effectiveById.get(outcomeId) ?? price;
    };

    const defaultPrice = outcomes.length > 0 ? 1 / outcomes.length : 0;
    const priceById = new Map(pricedOutcomes.map(outcome => [outcome.id, applyFee(outcome.price, outcome.id)]));
    
    const positionById = new Map<string, number>();
    const matchState = supabaseMatch.match_state as MultiOutcomeMatchState | null;
    (matchState?.positions || []).forEach((outcomeId, idx) => {
      positionById.set(outcomeId, idx + 1);
    });
    
    const outcomeSummaries = outcomes.map(outcome => ({
      id: outcome.id,
      slug: outcome.outcome_slug,
      label: outcome.label,
      price: priceById.get(outcome.id) ?? applyFee(defaultPrice, outcome.id),
      position: positionById.get(outcome.id)
    }));
    
    let homePrice = 33, drawPrice = 33, awayPrice = 33;
    
    if (pricedOutcomes.length >= 3) {
      const home = pricedOutcomes.find(o => o.outcome_slug === 'home') || pricedOutcomes[0];
      const draw = pricedOutcomes.find(o => o.outcome_slug === 'draw') || pricedOutcomes[1];
      const away = pricedOutcomes.find(o => o.outcome_slug === 'away') || pricedOutcomes[2];
      
      homePrice = home ? Math.round(applyFee(home.price, home.id) * 100) : 33;
      drawPrice = draw ? Math.round(applyFee(draw.price, draw.id) * 100) : 33;
      awayPrice = away ? Math.round(applyFee(away.price, away.id) * 100) : 33;
    } else if (pricedOutcomes.length === 2) {
      homePrice = Math.round(applyFee(pricedOutcomes[0].price, pricedOutcomes[0].id) * 100);
      awayPrice = Math.round(applyFee(pricedOutcomes[1].price, pricedOutcomes[1].id) * 100);
      drawPrice = 0;
    }
    
    return {
      id: supabaseMatch.id,
      title: supabaseMatch.title,
      sport: supabaseMatch.sport ?? null,
      aiResponse: supabaseMatch.ai_response ?? null,
      league: {
        id: 'converted',
        name: 'Polymarket',
        hasDraw: marketType === '1X2'
      },
      homeTeam: {
        id: `team-${homeTeamName}`,
        name: homeTeamName
      },
      awayTeam: {
        id: `team-${awayTeamName}`,
        name: awayTeamName
      },
      startTime: supabaseMatch.start_time,
      status: supabaseMatch.status === 'OPEN' ? 'SCHEDULED' : 
              supabaseMatch.status === 'LOCKED' ? 'LIVE' : 'RESOLVED',
      currentScore: { 
        home: supabaseMatch.home_goals ?? 0, 
        away: supabaseMatch.away_goals ?? 0 
      },
      simulationMinute: supabaseMatch.simulation_minute ?? undefined,
      marketType,
      matchState: supabaseMatch.match_state,
      outcomes: outcomeSummaries,
      prices: {
        home: { yes: homePrice, no: 100 - homePrice },
        away: { yes: awayPrice, no: 100 - awayPrice },
        draw: { yes: drawPrice, no: 100 - drawPrice }
      }
    };
  };

  const matchesWithData = useMemo(() => {
    return supabaseMatches.map(sm => {
      const marketId = sm.markets?.[0]?.id;
      if (selectedMarketId && marketId === selectedMarketId && selectedOutcomesForMarket.length > 0) {
        const merged = {
          ...sm,
          markets: (sm.markets || []).map(market => 
            market.id === selectedMarketId
              ? { ...market, outcomes: selectedOutcomesForMarket }
              : market
          )
        };
        return { match: convertSupabaseMatch(merged), supabaseMatch: merged };
      }
      return { match: convertSupabaseMatch(sm), supabaseMatch: sm };
    });
  }, [supabaseMatches, selectedMarketId, selectedOutcomesForMarket]);

  const selectedMatchData = useMemo(() => {
    if (!selectedMatchId) return null;
    return matchesWithData.find(({ match }) => match.id === selectedMatchId) || null;
  }, [matchesWithData, selectedMatchId]);

  const selectedMatch = selectedMatchData?.match ?? null;
  const selectedSupabaseMatch = selectedMatchData?.supabaseMatch ?? null;
  const selectedMarket = selectedSupabaseMatch?.markets?.[0];
  const selectedMarketOutcomes = selectedOutcomesForMarket.length > 0
    ? selectedOutcomesForMarket
    : (selectedMarket?.outcomes || []);
  const selectedMarketType = resolveMarketType(selectedMarket?.type ?? null, selectedMarketOutcomes);

  const marketStatusByMatchId = useMemo(() => {
    return supabaseMatches.reduce<Record<string, string | undefined>>((acc, match) => {
      acc[match.id] = match.markets?.[0]?.status;
      return acc;
    }, {});
  }, [supabaseMatches]);

  const visibleMatches = useMemo(() => {
    return matchesWithData
      .filter(({ match }) => {
        const matchDate = parseISO(match.startTime);
        return isSameDay(matchDate, currentDate);
      })
      .filter(({ match }) => selectedSport === 'all' || match.sport === selectedSport)
      .map(({ match }) => match);
  }, [matchesWithData, currentDate, selectedSport]);

  const sports = useMemo(() => {
    const unique = new Set<string>();
    matchesWithData.forEach(({ match }) => {
      if (match.sport) {
        unique.add(match.sport);
      }
    });
    return Array.from(unique).sort();
  }, [matchesWithData]);

  useEffect(() => {
    if (!selectedSupabaseMatch?.id) {
      setSelectedOutcomeIds([]);
      setActiveOutcomeId(null);
      return;
    }

    const outcomes = selectedMarketOutcomes;
    if (outcomes.length === 0) {
      setSelectedOutcomeIds([]);
      setActiveOutcomeId(null);
      return;
    }

    const defaultId = (() => {
      if (selectedMarketType === '1X2') {
        return outcomes.find(outcome => outcome.outcome_slug === 'home')?.id || outcomes[0].id;
      }
      if (selectedMarketType === 'BINARY') {
        return outcomes.find(outcome => outcome.outcome_slug === 'yes')?.id || outcomes[0].id;
      }
      return outcomes[0].id;
    })();

    setSelectedOutcomeIds(defaultId ? [defaultId] : []);
    setActiveOutcomeId(defaultId || null);
  }, [selectedSupabaseMatch?.id, selectedMarketOutcomes.length, selectedMarketType, selectedMarket?.id]);

  useEffect(() => {
    if (region === 'EU') {
      setBetType('yes');
    }
  }, [region]);

  const handleMatchSelect = (m: Match) => {
    setSelectedMatchId(m.id);
    setBetType('yes');
  };

  const handleOutcomeSelectionChange = (nextSelected: string[], activeId: string | null) => {
    setSelectedOutcomeIds(nextSelected);
    setActiveOutcomeId(activeId || nextSelected[0] || null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F0F2F5] overflow-hidden font-sans">
      <Navbar 
        region={region} 
        onRegionChange={setRegion}
        selectedMatchId={selectedMatch?.id ?? null}
      />
      
      <main className="flex flex-1 overflow-hidden p-4 gap-4">
        
        <aside className="w-80 flex-shrink-0 z-10 shadow-sm border border-gray-200 bg-white rounded-2xl overflow-hidden flex flex-col">
          <LeftPanel 
            currentDate={currentDate} 
            onDateChange={setCurrentDate}
            matches={visibleMatches}
            onMatchSelect={handleMatchSelect}
            selectedMatchId={selectedMatch?.id}
            region={region}
            marketStatusByMatchId={marketStatusByMatchId}
            sports={sports}
            selectedSport={selectedSport}
            onSportSelect={setSelectedSport}
          />
        </aside>

        
        <section className="flex-1 min-w-0 relative z-0 flex flex-col shadow-sm border border-gray-200 bg-white rounded-2xl overflow-hidden">
          <CenterPanel 
            match={selectedMatch} 
            supabaseMatch={selectedSupabaseMatch}
            realtimeOutcomes={selectedOutcomesForMarket}
            selectedOutcomeIds={selectedOutcomeIds}
            activeOutcomeId={activeOutcomeId}
            onOutcomeSelectionChange={handleOutcomeSelectionChange}
            marketType={selectedMarketType}
            betType={betType}
            onBetTypeChange={setBetType}
            region={region}
          />
        </section>

        
        <aside className="w-80 flex-shrink-0 z-10 shadow-sm border border-gray-200 bg-white rounded-2xl overflow-hidden flex flex-col">
          <RightPanel 
             match={selectedMatch}
             selectedOutcomeIds={selectedOutcomeIds}
             activeOutcomeId={activeOutcomeId}
             supabaseMatch={selectedSupabaseMatch}
             realtimeOutcomes={selectedOutcomesForMarket}
             marketType={selectedMarketType}
             betType={betType}
             onBetTypeChange={setBetType}
             region={region}
          />
        </aside>
      </main>
    </div>
  );
}
