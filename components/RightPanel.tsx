'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Match, SupabaseMatch, Outcome, Position } from '../types';
import { useAuth } from '@/lib/AuthContext';
import { useNotification } from '@/lib/NotificationContext';
import { useUserPortfolio } from '@/lib/hooks';
import { buildEffectiveOutcomePricing } from '@/utils/odds';
import { usePositions } from '@/lib/hooks';
import { Region } from './Navbar';
import { supabase } from '@/lib/supabaseClient';
import RightPanelHeader from './right-panel/RightPanelHeader';
import OutcomeSelectionPanel from './right-panel/OutcomeSelectionPanel';
import BuyPanel from './right-panel/BuyPanel';
import SellPanel from './right-panel/SellPanel';
import TradeSummary from './right-panel/TradeSummary';
import PrimaryAction from './right-panel/PrimaryAction';
import SlippageModal from './right-panel/SlippageModal';

interface RightPanelProps {
  match: Match | null;
  selectedOutcomeIds?: string[];
  activeOutcomeId?: string | null;
  supabaseMatch?: SupabaseMatch | null;
  realtimeOutcomes?: Outcome[];
  marketType?: string;
  betType?: 'yes' | 'no';
  onBetTypeChange?: (betType: 'yes' | 'no') => void;
  region?: Region;
}

type PendingBuy = {
  id: string;
  amount: number;
  betType: 'yes' | 'no';
  selectedOutcomeId: string;
  marketId: string;
  outcomeName: string;
  region: Region;
  isDemoOutcome: boolean;
  matchId: string;
  scoreSnapshot: { home: number; away: number };
  startedAt: number;
};

type TradeQuote = {
  shares: number;
  price_per_share: number;
  odds_decimal?: number | null;
  fee_rate_debug?: number | null;
};

type SlippageState = {
  order: PendingBuy;
  minShares: number;
  expectedShares: number;
  newShares: number;
  newPrice: number;
  message?: string;
};

const DELAY_SECONDS = 6;
const SLIPPAGE_TOLERANCE = 0.01;

export default function RightPanel({
  match,
  selectedOutcomeIds = [],
  activeOutcomeId = null,
  supabaseMatch,
  realtimeOutcomes,
  marketType,
  betType: controlledBetType,
  onBetTypeChange,
  region = 'EU'
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [localBetType, setLocalBetType] = useState<'yes' | 'no'>(controlledBetType ?? 'yes');
  const betType = controlledBetType ?? localBetType;
  const setBetType = onBetTypeChange ?? setLocalBetType;
  const [amount, setAmount] = useState<string>('');
  const [sellPercent, setSellPercent] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [pendingBuy, setPendingBuy] = useState<PendingBuy | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [slippageState, setSlippageState] = useState<SlippageState | null>(null);
  const [acceptingNewOdds, setAcceptingNewOdds] = useState(false);
  const pendingBuyRef = useRef<PendingBuy | null>(null);
  const prevScoreRef = useRef<{ home: number; away: number } | null>(null);
  const buyAbortRef = useRef<AbortController | null>(null);
  const quoteRequestIdRef = useRef(0);
  
  const { user, isAuthenticated, session } = useAuth();
  const { notify } = useNotification();
  const { profile } = useUserPortfolio();
  const { positions } = usePositions();

  const delayFunctionUrl = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const functionName = 'place-bet';
    if (!baseUrl) return '';
    const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${normalized}/functions/v1/${functionName}`;
  }, []);

  const market = supabaseMatch?.markets?.[0];
  const marketId = market?.id;
  const isMarketLocked = market?.status ? market.status !== 'OPEN' : false;
  const baseSlippageLimit = 0.15;
  const noCooldownPercent = 0.10;
  const riskMultiplier = market?.risk_multiplier ?? 1;
  const totalLiquidity = market?.liquidity_usdc ?? 0;
  const maxAllowedBet = totalLiquidity * baseSlippageLimit * riskMultiplier;
  const noCooldownLimit = Math.min(totalLiquidity * noCooldownPercent, maxAllowedBet);
  const isMarketSuspended = riskMultiplier <= 0;

  const outcomes = (realtimeOutcomes && realtimeOutcomes.length > 0)
    ? realtimeOutcomes
    : (market?.outcomes || []);
  const marketOutcomes = outcomes.length > 0 ? outcomes : (market?.outcomes || []);

  useEffect(() => {
    if (controlledBetType) {
      setLocalBetType(controlledBetType);
    }
  }, [controlledBetType]);

  useEffect(() => {
    if (region === 'EU' && betType !== 'yes') {
      setBetType('yes');
    }
  }, [betType, region, setBetType]);

  const { pricedOutcomes, effectiveById, normalizedById, totalEffective } = useMemo(() => {
    if (outcomes.length === 0) {
      return { pricedOutcomes: [], effectiveById: new Map(), normalizedById: new Map(), totalEffective: 0 };
    }
    return buildEffectiveOutcomePricing(outcomes);
  }, [outcomes]);
  const priceByOutcomeId = useMemo(() => {
    return effectiveById;
  }, [effectiveById]);
  const positionByOutcomeId = useMemo(() => {
    return new Map(positions.map((pos: Position) => [pos.outcome_id, pos]));
  }, [positions]);

  useEffect(() => {
    pendingBuyRef.current = pendingBuy;
  }, [pendingBuy]);

  const refreshCooldown = useCallback(async () => {
    if (!user?.id || !marketId) {
      setCooldownUntil(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_cooldowns')
        .select('locked_until')
        .eq('user_id', user.id)
        .eq('market_id', marketId)
        .maybeSingle();

      if (error) {
        const message = typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: string }).message || '')
          : '';
        if (message) {
          console.warn('Cooldown fetch error:', message);
        }
        setCooldownUntil(null);
        return;
      }

      const expiry = data?.locked_until;
      if (!expiry) {
        setCooldownUntil(null);
        return;
      }

      const expiryDate = new Date(expiry);
      if (Number.isNaN(expiryDate.getTime())) {
        setCooldownUntil(null);
        return;
      }

      setCooldownUntil(expiryDate);
    } catch (err) {
      console.error('Cooldown fetch error:', err);
    }
  }, [marketId, user?.id]);

  useEffect(() => {
    refreshCooldown();
  }, [refreshCooldown]);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownSeconds(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) {
        setCooldownUntil(null);
      }
    };

    update();
    const intervalId = window.setInterval(update, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldownUntil]);
  const matchId = match?.id ?? '';
  const homeTeamName = match?.homeTeam.name ?? '';
  const awayTeamName = match?.awayTeam.name ?? '';
  const effectiveMarketType = marketType || match?.marketType || (match?.league.hasDraw ? '1X2' : 'BINARY');
  const normalizedMarketType = (effectiveMarketType || '').toUpperCase();
  const selectedOutcomeLabels = selectedOutcomeIds
    .map(id => {
      const outcome = marketOutcomes.find(o => o.id === id);
      if (!outcome) return '';
      if (outcome.outcome_slug === 'home') return homeTeamName || outcome.label;
      if (outcome.outcome_slug === 'away') return awayTeamName || outcome.label;
      if (outcome.outcome_slug === 'draw') return 'Draw';
      return outcome.label || outcome.outcome_slug;
    })
    .filter(Boolean);

  const primaryOutcomeId = activeOutcomeId || selectedOutcomeIds[0] || '';
  
  let currentOutcome: Outcome | undefined;
  const foundOutcome = outcomes.find(o => o.id === primaryOutcomeId);
  const foundPricedOutcome = pricedOutcomes.find(o => o.id === primaryOutcomeId);
  
  if (foundOutcome) {
    currentOutcome = foundOutcome;
  } else if (foundPricedOutcome) {
    currentOutcome = {
      id: foundPricedOutcome.id,
      outcome_slug: foundPricedOutcome.outcome_slug || '',
      label: foundPricedOutcome.label,
      pool: 0
    };
  }

  if (!currentOutcome && outcomes.length > 0) {
    currentOutcome = outcomes[0];
  } else if (!currentOutcome && pricedOutcomes.length > 0) {
    const first = pricedOutcomes[0];
    currentOutcome = {
      id: first.id,
      outcome_slug: first.outcome_slug || '',
      label: first.label,
      pool: 0
    };
  }

  const outcomeSlug = currentOutcome?.outcome_slug ?? '';
  const outcomeName = (() => {
    if (outcomeSlug === 'home') return homeTeamName || currentOutcome?.label || 'Home';
    if (outcomeSlug === 'away') return awayTeamName || currentOutcome?.label || 'Away';
    if (outcomeSlug === 'draw') return 'Draw';
    return currentOutcome?.label || outcomeSlug || 'Outcome';
  })();
  
  if (!currentOutcome) {
    currentOutcome = {
      id: `demo-${primaryOutcomeId || 'outcome'}-${matchId || 'unknown'}`,
      outcome_slug: outcomeSlug || 'outcome',
      label: outcomeName || 'Outcome',
      pool: 0
    };
  }
  
  const selectedOutcomeId = currentOutcome.id;
  const isDemoOutcome = selectedOutcomeId.startsWith('demo-');
  const requiresQuote = !isDemoOutcome;
  const selectedOutcomeLabelList = selectedOutcomeLabels.join(', ');
  const noBetTargetsLabel = marketOutcomes
    .filter(o => o.id !== selectedOutcomeId)
    .map(o => o.label || o.outcome_slug)
    .join(' + ');
  const badgeText = (match?.sport || 'PM').slice(0, 2).toUpperCase();

  const currentPosition = positionByOutcomeId.get(selectedOutcomeId);
  const positionShares = currentPosition?.shares || 0;
  const positionAmountSpent = currentPosition?.amount_spent || 0;
  const positionAvgPrice = currentPosition?.avg_price || 0;
  const otherOutcomes = marketOutcomes.filter(outcome => outcome.id !== selectedOutcomeId);
  const noPositions = otherOutcomes
    .map(outcome => positionByOutcomeId.get(outcome.id))
    .filter((pos): pos is Position => Boolean(pos));
  const noPositionShares = noPositions.reduce((sum, pos) => sum + (pos.shares || 0), 0);
  const noPositionAmountSpent = noPositions.reduce((sum, pos) => sum + (pos.amount_spent || 0), 0);
  const noPositionAvgPrice = noPositionShares > 0 ? noPositionAmountSpent / noPositionShares : 0;

  const isNoBet = region === 'US' && betType === 'no';
  const isMultiSelection = normalizedMarketType.includes('MULTI') && selectedOutcomeIds.length > 1;
  const activePositionShares = isNoBet ? noPositionShares : positionShares;
  const activePositionAmountSpent = isNoBet ? noPositionAmountSpent : positionAmountSpent;
  const activePositionAvgPrice = isNoBet ? noPositionAvgPrice : positionAvgPrice;

  const quickAmounts = [1, 20, 100];
  const sellPercentOptions = [25, 50, 75, 100];

  const handleQuickAdd = (val: number) => {
      setAmount(prev => {
          const num = parseFloat(prev) || 0;
          return (num + val).toString();
      });
  };
  
  const numAmount = parseFloat(amount) || 0;
  useEffect(() => {
    if (activeTab !== 'buy' || !marketId || !selectedOutcomeId || numAmount <= 0 || isDemoOutcome) {
      quoteRequestIdRef.current += 1;
      setQuote(null);
      setQuoteError(null);
      setQuoteLoading(false);
      return;
    }

    const requestId = ++quoteRequestIdRef.current;
    setQuoteLoading(true);
    setQuoteError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('get_trade_quote', {
          p_market_id: marketId,
          p_outcome_id: selectedOutcomeId,
          p_investment_usdc: numAmount
        });

        if (quoteRequestIdRef.current !== requestId) return;

        if (error) {
          setQuote(null);
          setQuoteError(error.message || 'Quote failed');
          return;
        }

        setQuote((data || null) as TradeQuote | null);
        setQuoteError(null);
      } catch (err) {
        if (quoteRequestIdRef.current !== requestId) return;
        setQuote(null);
        setQuoteError(err instanceof Error ? err.message : 'Quote failed');
      } finally {
        if (quoteRequestIdRef.current === requestId) {
          setQuoteLoading(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, isDemoOutcome, marketId, numAmount, selectedOutcomeId]);
  const getCooldownSecondsForTrade = useCallback((investment: number) => {
    if (investment <= 0 || totalLiquidity <= 0) {
      return 0;
    }

    const tradePercent = (investment / totalLiquidity) * 100;
    if (tradePercent <= 10) {
      return 0;
    }

    const calcMinutes = 0.8 * Math.pow(tradePercent - 10, 2);
    let seconds = Math.floor(calcMinutes * 60);
    if (seconds < 5) {
      seconds = 5;
    }
    return seconds;
  }, [totalLiquidity]);
  const predictedCooldownSeconds = useMemo(
    () => getCooldownSecondsForTrade(numAmount),
    [getCooldownSecondsForTrade, numAmount]
  );
  const willTriggerCooldown = predictedCooldownSeconds > 0;
  
  const currentPricedOutcome = pricedOutcomes.find(o => o.id === currentOutcome?.id);
  
  const fallbackPrice = outcomes.length > 0 ? 1 / outcomes.length : 0.33;
  const baseYesPrice = currentPricedOutcome?.price || fallbackPrice;
  const normalizedYesPrice = normalizedById.get(currentOutcome?.id ?? '') ?? baseYesPrice;
  const yesPrice = effectiveById.get(currentOutcome?.id ?? '') ?? normalizedYesPrice;
  const noPrice = totalEffective > 0 ? Math.max(0, totalEffective - yesPrice) : (1 - normalizedYesPrice);
  
  const activePrice = betType === 'no' ? noPrice : yesPrice;

  const quoteShares = Number(quote?.shares ?? 0);
  const quotePricePerShare = Number(quote?.price_per_share ?? 0);
  const quoteOddsDecimal = Number(quote?.odds_decimal ?? 0);
  const hasValidQuote = Boolean(quote && quote.shares > 0);
  const quoteSharesLabel = hasValidQuote ? quoteShares.toFixed(2) : '--';
  const quotePriceLabel = region === 'US' ? 'Price per share' : 'Kurz';
  const quotePriceValue = hasValidQuote
    ? (region === 'US'
        ? `$${quotePricePerShare.toFixed(2)}`
        : (quoteOddsDecimal > 0 ? quoteOddsDecimal.toFixed(2) : quotePricePerShare.toFixed(2)))
    : '--';

  const potentialReturn = hasValidQuote ? quoteShares : 0;
  const netProfit = hasValidQuote ? potentialReturn - numAmount : 0;
  const roi = hasValidQuote && numAmount > 0 ? (netProfit / numAmount) * 100 : 0;

  const sharesToSell = activePositionShares * (sellPercent / 100);
  const noSharesToSell = noPositions.map(pos => ({
    outcomeId: pos.outcome_id,
    shares: (pos.shares || 0) * (sellPercent / 100)
  }));
  const noSharesToSellTotal = noSharesToSell.reduce((sum, item) => sum + item.shares, 0);
  const estimatedNoProceeds = noSharesToSell.reduce((sum, item) => {
    const price = priceByOutcomeId.get(item.outcomeId) ?? fallbackPrice;
    return sum + item.shares * price;
  }, 0);
  const estimatedProceeds = isNoBet ? estimatedNoProceeds : sharesToSell * yesPrice;
  const sharesToSellDisplay = isNoBet ? noSharesToSellTotal : sharesToSell;
  const isBuyPending = Boolean(pendingBuy);
  const isCooldownActive = cooldownSeconds > 0;
  const isProcessingBuy = loading || acceptingNewOdds;
  const isBuyInteractionDisabled = isProcessingBuy || !isAuthenticated || isMarketLocked || isBuyPending || isCooldownActive || isMarketSuspended;
  const primaryActionDisabled = activeTab === 'buy'
    ? (isProcessingBuy || isBuyPending || !isAuthenticated || isMarketLocked || isCooldownActive || isMarketSuspended || numAmount <= 0 || numAmount > maxAllowedBet || (requiresQuote && (quoteLoading || !hasValidQuote)))
    : (isProcessingBuy || !isAuthenticated || isMarketLocked || activePositionShares <= 0);
  const primaryButtonLabel = useMemo(() => {
    if (isProcessingBuy) {
      return region === 'US' ? 'Processing...' : 'Spracovavam...';
    }
    if (activeTab === 'buy') {
      if (pendingBuy) {
        return `Vsadzam za ${countdownSeconds}s`;
      }
      if (!requiresQuote) {
        return region === 'US'
          ? `Buy ${betType.toUpperCase()} ${numAmount.toFixed(2)} USDC`
          : `Kupit ${numAmount.toFixed(2)} USDC`;
      }
      if (requiresQuote && quoteLoading) {
        return region === 'US' ? 'Calculating quote...' : 'Calculating quote...';
      }
      if (requiresQuote && !hasValidQuote) {
        return region === 'US' ? 'Get quote' : 'Get quote';
      }
      return region === 'US'
        ? `Buy ${betType.toUpperCase()} ${quoteSharesLabel} shares`
        : `Kupit ${quoteSharesLabel} akcii`;
    }
    return region === 'US'
      ? `Sell ${sellPercent}% (${sharesToSellDisplay.toFixed(2)} shares)`
      : `Predat ${sellPercent}% (${sharesToSellDisplay.toFixed(2)} akcii)`;
  }, [activeTab, betType, countdownSeconds, hasValidQuote, isProcessingBuy, numAmount, pendingBuy, quoteLoading, quoteSharesLabel, region, requiresQuote, sellPercent, sharesToSellDisplay]);

  const handlePrimaryAction = () => {
    if (activeTab === 'buy') {
      void handleBuy();
      return;
    }

    void handleSell();
  };

  const cancelPendingBuy = useCallback((message?: string) => {
    if (message) {
      notify(message, 'warning');
    }
    if (buyAbortRef.current) {
      buyAbortRef.current.abort();
      buyAbortRef.current = null;
    }
    setPendingBuy(null);
  }, [notify]);

  const executeDelayedBuy = useCallback(async (order: PendingBuy) => {
    if (!delayFunctionUrl) {
      cancelPendingBuy('Delay function not configured');
      return;
    }

    const controller = new AbortController();
    buyAbortRef.current = controller;
    const authToken = session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    try {
      const response = await fetch(delayFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          apikey: anonKey
        },
        body: JSON.stringify({
          market_id: order.marketId,
          outcome_id: order.selectedOutcomeId,
          investment: order.amount,
          user_id: user?.id,
          bet_type: order.betType === 'no' ? 'NO' : 'YES'
        }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Delayed buy failed');
      }

      if (payload?.success === false) {
        throw new Error(payload.error || 'Delayed buy failed');
      }

      if (pendingBuyRef.current?.id !== order.id) {
        return;
      }

      if (order.region === 'US' && order.betType === 'no') {
        const boughtShares = payload?.total_shares ?? payload?.shares ?? payload?.shares_bought ?? 0;
        if (boughtShares) {
          notify(`NO ${order.outcomeName}: ${Number(boughtShares).toFixed(4)} shares for ${order.amount.toFixed(2)} USDC`, 'success');
        } else {
          notify(`NO ${order.outcomeName}: Buy placed for ${order.amount.toFixed(2)} USDC`, 'success');
        }
      } else {
        const boughtShares = (payload?.total_shares ?? payload?.shares) || payload?.shares_bought || 0;
        notify(`${order.region === 'US' ? 'YES ' : ''}${order.outcomeName}: ${Number(boughtShares).toFixed(4)} shares for ${order.amount.toFixed(2)} USDC`, 'success');
      }

      setAmount('');
      refreshCooldown();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Delayed buy failed';
      notify(errorMessage, 'error');
      console.error('Delayed buy error:', error);
    } finally {
      if (buyAbortRef.current === controller) {
        buyAbortRef.current = null;
      }
      setPendingBuy(prev => (prev?.id === order.id ? null : prev));
    }
  }, [cancelPendingBuy, delayFunctionUrl, notify, refreshCooldown, session?.access_token, user?.id]);

  const executeBuy = useCallback(async (order: PendingBuy, minShares: number, acceptNewOdds: boolean) => {
    if (!isAuthenticated || !user) {
      cancelPendingBuy('Please sign in to continue');
      return;
    }

    if (order.matchId !== supabaseMatch?.id) {
      cancelPendingBuy('Match changed, order cancelled');
      return;
    }

    if (isMarketLocked) {
      cancelPendingBuy('Market locked, order cancelled');
      return;
    }

    const currentHome = match?.currentScore?.home ?? 0;
    const currentAway = match?.currentScore?.away ?? 0;
    if (currentHome !== order.scoreSnapshot.home || currentAway !== order.scoreSnapshot.away) {
      cancelPendingBuy('Score changed, order cancelled');
      return;
    }

    if (maxAllowedBet > 0 && order.amount > maxAllowedBet) {
      cancelPendingBuy('Max bet exceeded, order cancelled');
      return;
    }

    if (profile && order.amount > profile.usdc_balance) {
      cancelPendingBuy('Insufficient balance');
      return;
    }

    setLoading(true);
    try {
      if (order.isDemoOutcome) {
        notify(`Demo: Buy ${order.amount.toFixed(2)} USDC`, 'success');
        setAmount('');
        setPendingBuy(null);
        return;
      }

      if (!supabaseMatch) {
        notify('Market not available', 'error');
        return;
      }

      const { data, error } = await supabase.rpc('buy_outcome', {
        p_market_id: order.marketId,
        p_outcome_id: order.selectedOutcomeId,
        p_investment_usdc: order.amount,
        p_user_id: user.id,
        p_min_shares_out: minShares,
        p_accept_new_odds: acceptNewOdds
      });

      if (error) {
        throw error;
      }

      if (data && data.success === false) {
        if (data.error === 'SLIPPAGE_DETECTED') {
          setSlippageState({
            order,
            minShares,
            expectedShares: Number(data.expected_shares ?? minShares),
            newShares: Number(data.new_shares ?? 0),
            newPrice: Number(data.new_price ?? 0),
            message: data.message
          });
          return;
        }

        throw new Error(data.error || 'Buy failed');
      }

      const boughtShares = Number(data?.shares_bought ?? data?.shares ?? data?.total_shares ?? 0);
      if (order.region === 'US' && order.betType === 'no') {
        if (boughtShares) {
          notify(`NO ${order.outcomeName}: ${boughtShares.toFixed(4)} shares for ${order.amount.toFixed(2)} USDC`, 'success');
        } else {
          notify(`NO ${order.outcomeName}: Buy placed for ${order.amount.toFixed(2)} USDC`, 'success');
        }
      } else {
        const prefix = order.region === 'US' ? 'YES ' : '';
        notify(`${prefix}${order.outcomeName}: ${boughtShares.toFixed(4)} shares for ${order.amount.toFixed(2)} USDC`, 'success');
      }

      setAmount('');
      refreshCooldown();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Buy failed';
      notify(errorMessage, 'error');
      console.error('Buy error:', error);
    } finally {
      setLoading(false);
      setPendingBuy(null);
    }
  }, [cancelPendingBuy, isAuthenticated, isMarketLocked, match?.currentScore?.away, match?.currentScore?.home, maxAllowedBet, notify, profile, refreshCooldown, supabaseMatch, user]);

  useEffect(() => {
    if (!pendingBuy) {
      setCountdownSeconds(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - pendingBuy.startedAt) / 1000);
      const remaining = Math.max(0, DELAY_SECONDS - elapsed);
      setCountdownSeconds(remaining);
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pendingBuy]);

  useEffect(() => {
    const home = match?.currentScore?.home ?? 0;
    const away = match?.currentScore?.away ?? 0;
    const prev = prevScoreRef.current;

    if (prev && pendingBuy && (home !== prev.home || away !== prev.away)) {
      cancelPendingBuy('Goal detected, order cancelled');
    }

    prevScoreRef.current = { home, away };
  }, [match?.currentScore?.away, match?.currentScore?.home, pendingBuy, cancelPendingBuy]);

  useEffect(() => {
    if (pendingBuy && match?.id && pendingBuy.matchId !== match.id) {
      cancelPendingBuy('Match changed, order cancelled');
    }
  }, [match?.id, pendingBuy, cancelPendingBuy]);

  useEffect(() => {
    if (pendingBuy && isMarketLocked) {
      cancelPendingBuy('Market locked, order cancelled');
    }
  }, [isMarketLocked, pendingBuy, cancelPendingBuy]);

  const handleBuy = async () => {
    if (pendingBuy) {
      notify('Pending order already scheduled', 'warning');
      return;
    }
    if (isMarketLocked) {
      notify('Market is locked', 'warning');
      return;
    }
    if (!isAuthenticated || !user) {
      notify('Please sign in', 'warning');
      return;
    }

    if (isCooldownActive) {
      notify(`Cooldown active: ${cooldownSeconds}s`, 'warning');
      return;
    }

    if (numAmount <= 0) {
      notify('Enter a valid amount', 'error');
      return;
    }

    if (isMarketSuspended || maxAllowedBet <= 0) {
      notify('Market is suspended', 'error');
      return;
    }

    if (numAmount > maxAllowedBet) {
      notify(`Max allowed bet is ${maxAllowedBet.toFixed(2)} USDC`, 'error');
      return;
    }

    if (profile && numAmount > profile.usdc_balance) {
      notify('Insufficient balance', 'error');
      return;
    }

    if (!selectedOutcomeId) {
      notify('Outcome not available', 'error');
      return;
    }

    if (!market || !marketId || !match) {
      notify('Market not available', 'error');
      return;
    }

    if (!isDemoOutcome) {
      if (quoteLoading) {
        notify('Calculating quote...', 'info');
        return;
      }
      if (!hasValidQuote) {
        notify('Quote not available', 'error');
        return;
      }
    }

    const scoreSnapshot = {
      home: match.currentScore?.home ?? 0,
      away: match.currentScore?.away ?? 0
    };

    const order: PendingBuy = {
      id: `${Date.now()}`,
      amount: numAmount,
      betType,
      selectedOutcomeId,
      marketId,
      outcomeName,
      region,
      isDemoOutcome,
      matchId: match.id,
      scoreSnapshot,
      startedAt: Date.now()
    };

    setSlippageState(null);
    const minShares = hasValidQuote ? quoteShares * (1 - SLIPPAGE_TOLERANCE) : 0;

    if (willTriggerCooldown) {
      setPendingBuy(order);
      notify(`Processing in ${DELAY_SECONDS}s`, 'info');
      void executeDelayedBuy(order);
      return;
    }

    await executeBuy(order, minShares, false);
  };

  const handleAcceptNewOdds = async () => {
    if (!slippageState) return;
    const { order, minShares } = slippageState;
    setSlippageState(null);
    setAcceptingNewOdds(true);
    await executeBuy(order, minShares, true);
    setAcceptingNewOdds(false);
  };

  const handleSell = async () => {
    if (isMarketLocked) {
      notify('Trh je uzamknuty', 'warning');
      return;
    }
    if (!isAuthenticated || !user) {
      notify('Prosim prihlaste sa', 'warning');
      return;
    }

    if (activePositionShares <= 0) {
      notify('Nemate ziadne akcie na predaj', 'error');
      return;
    }

    if (sharesToSellDisplay <= 0) {
      notify('Prosim vyberte pocet akcii na predaj', 'error');
      return;
    }

    if (!selectedOutcomeId) {
      notify('Vysledok nie je k dispozicii', 'error');
      return;
    }

    setLoading(true);
    try {
      if (!market) {
        notify('Trh nie je dostupny', 'error');
        return;
      }
      
      if (isDemoOutcome) {
        notify(`Demo: Predaj ${sharesToSellDisplay.toFixed(2)} akcii`, 'success');
        setSellPercent(100);
        return;
      }

      if (!supabaseMatch) {
        notify('Trh nie je dostupny', 'error');
        return;
      }

      if (isNoBet) {
        const sellTargets = noPositions
          .map(pos => ({
            outcomeId: pos.outcome_id,
            sharesToSell: (pos.shares || 0) * (sellPercent / 100)
          }))
          .filter(target => target.sharesToSell > 0);

        if (sellTargets.length === 0) {
          notify('Nemate ziadne akcie na predaj', 'error');
          return;
        }

        let totalProceeds = 0;
        for (const target of sellTargets) {
          const response = await fetch('/api/sell-outcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              outcomeId: target.outcomeId,
              sharesToSell: target.sharesToSell,
              marketId: marketId,
              userId: user.id
            })
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error);
          }

          totalProceeds += data.data?.proceeds || 0;
        }

        notify(`Predaj ${sharesToSellDisplay.toFixed(4)} akcii za ${totalProceeds.toFixed(2)} USDC`, 'success');
      } else {
        const response = await fetch('/api/sell-outcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcomeId: selectedOutcomeId,
            sharesToSell: sharesToSell,
            marketId: marketId,
            userId: user.id
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error);
        }

        notify(`Predaj ${sharesToSellDisplay.toFixed(4)} akcii za ${data.data.proceeds?.toFixed(2) || '...'} USDC`, 'success');
      }

      setSellPercent(100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Chyba pri predaji';
      notify(errorMessage, 'error');
      console.error('Sell error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!match) {
    return (
      <div className="bg-white h-full flex items-center justify-center text-gray-500">
        Select a match
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white text-gray-900">
      <RightPanelHeader
        match={match}
        supabaseMatch={supabaseMatch}
        normalizedMarketType={normalizedMarketType}
        outcomeSlug={outcomeSlug}
        outcomeName={outcomeName}
        region={region}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badgeText={badgeText}
      />

      <div className="p-4 bg-white flex-1 flex flex-col overflow-y-auto">
        <OutcomeSelectionPanel
          region={region}
          activeTab={activeTab}
          betType={betType}
          onBetTypeChange={setBetType}
          isMarketLocked={isMarketLocked}
          yesPrice={yesPrice}
          noPrice={noPrice}
          activePrice={activePrice}
          outcomeName={outcomeName}
          isMultiSelection={isMultiSelection}
          selectedOutcomeLabelList={selectedOutcomeLabelList}
          noBetTargetsLabel={noBetTargetsLabel}
        />

        {activeTab === 'buy' && (
          <BuyPanel
            region={region}
            balance={profile?.usdc_balance ?? 0}
            isCooldownActive={isCooldownActive}
            cooldownSeconds={cooldownSeconds}
            pendingBuy={Boolean(pendingBuy)}
            countdownSeconds={countdownSeconds}
            isMarketSuspended={isMarketSuspended}
            maxAllowedBet={maxAllowedBet}
            noCooldownLimit={noCooldownLimit}
            willTriggerCooldown={willTriggerCooldown}
            predictedCooldownSeconds={predictedCooldownSeconds}
            amount={amount}
            numAmount={numAmount}
            onAmountChange={setAmount}
            onQuickAdd={handleQuickAdd}
            onClear={() => setAmount('')}
            quickAmounts={quickAmounts}
            isBuyInteractionDisabled={isBuyInteractionDisabled}
          />
        )}

        {activeTab === 'sell' && (
          <SellPanel
            region={region}
            isNoBet={isNoBet}
            activePositionShares={activePositionShares}
            activePositionAvgPrice={activePositionAvgPrice}
            activePositionAmountSpent={activePositionAmountSpent}
            sharesToSellDisplay={sharesToSellDisplay}
            sellPercent={sellPercent}
            onSellPercentChange={setSellPercent}
            sellPercentOptions={sellPercentOptions}
            isMarketLocked={isMarketLocked}
          />
        )}

        <TradeSummary
          activeTab={activeTab}
          region={region}
          quoteLoading={quoteLoading}
          hasValidQuote={hasValidQuote}
          quoteShares={quoteShares}
          quotePriceLabel={quotePriceLabel}
          quotePriceValue={quotePriceValue}
          quoteError={quoteError}
          potentialReturn={potentialReturn}
          netProfit={netProfit}
          roi={roi}
          sharesToSellDisplay={sharesToSellDisplay}
          activePrice={activePrice}
          isMarketLocked={isMarketLocked}
          estimatedProceeds={estimatedProceeds}
          activePositionShares={activePositionShares}
        />

        <PrimaryAction
          activeTab={activeTab}
          region={region}
          betType={betType}
          disabled={primaryActionDisabled}
          label={primaryButtonLabel}
          onAction={handlePrimaryAction}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <SlippageModal
        slippageState={slippageState}
        acceptingNewOdds={acceptingNewOdds}
        onClose={() => setSlippageState(null)}
        onAccept={() => void handleAcceptNewOdds()}
      />
    </div>
  );
}
