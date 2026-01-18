'use client';

import Link from 'next/link';
import { User, Goal, Activity, Trophy } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useState, useRef, useEffect, type FormEvent, useCallback } from 'react';
import AuthModal from './AuthModal';
import PortfolioDropdown from './PortfolioDropdown';
import { clsx } from 'clsx';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/lib/NotificationContext';
import PriceChart from './PriceChart';
import type { Outcome } from '@/types';

type PeriodType = 'GLOBAL' | 'MONTHLY' | 'WEEKLY';

interface LeaderboardEntry {
  id: string;
  user_id: string;
  period_type: PeriodType;
  period_key: string;
  total_bets: number;
  won_bets: number;
  volume_usdc: string;
  net_profit_usdc: string;
  roi_percentage: string;
  last_updated: string;
  profiles?: { username?: string; email?: string } | null;
}

export type Region = 'US' | 'EU';

interface NavbarProps {
  region?: Region;
  onRegionChange?: (region: Region) => void;
  selectedMatchId?: string | null;
}

export default function Navbar({ region = 'EU', onRegionChange, selectedMatchId }: NavbarProps) {
  const { isAuthenticated, user } = useAuth();
  const { notify } = useNotification();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);
  const [isGoalOpen, setIsGoalOpen] = useState(false);
  const [goalMatchId, setGoalMatchId] = useState('');
  const [goalTeam, setGoalTeam] = useState<'HOME' | 'AWAY'>('HOME');
  const [isGoalLoading, setIsGoalLoading] = useState(false);
  const goalDropdownRef = useRef<HTMLDivElement>(null);
  const [isDebugChartOpen, setIsDebugChartOpen] = useState(false);
  const [debugMatchId, setDebugMatchId] = useState('');
  const [debugMarkets, setDebugMarkets] = useState<Array<{ id: string; type?: string | null; outcomes: Outcome[] }>>([]);
  const [debugMarketId, setDebugMarketId] = useState<string | null>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const debugDropdownRef = useRef<HTMLDivElement>(null);

  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<PeriodType>('GLOBAL');
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const leaderboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (goalDropdownRef.current && !goalDropdownRef.current.contains(target)) {
        setIsGoalOpen(false);
      }
      if (debugDropdownRef.current && !debugDropdownRef.current.contains(target)) {
        setIsDebugChartOpen(false);
      }
      if (leaderboardRef.current && !leaderboardRef.current.contains(target)) {
        setIsLeaderboardOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedMatchId) return;
    setGoalMatchId(selectedMatchId);
    setDebugMatchId(prev => prev || selectedMatchId);
  }, [selectedMatchId]);

  const fetchLeaderboard = useCallback(async (period: PeriodType) => {
    setIsLeaderboardLoading(true);
    try {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*, profiles:user_id')
        .eq('period_type', period)
        .order('net_profit_usdc', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLeaderboardData((data || []) as LeaderboardEntry[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chyba pri načítaní leaderboardu';
      notify(message, 'error');
    } finally {
      setIsLeaderboardLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (isLeaderboardOpen) {
      fetchLeaderboard(leaderboardPeriod);
    }
  }, [isLeaderboardOpen, leaderboardPeriod, fetchLeaderboard]);

  const formatNumber = (value: string, decimals = 2) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPercent = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0%';
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const handleSeedTestData = async () => {
    setIsSeedingData(true);
    try {
      const response = await fetch('/api/seed-test-data', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Test data loaded!\n${data.data.matches} matches\n${data.data.markets} markets\n${data.data.outcomes} outcomes`);
        window.location.reload();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Failed to seed data: ${error}`);
    } finally {
      setIsSeedingData(false);
    }
  };

  const handleTriggerGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMatchId = goalMatchId.trim();
    if (!trimmedMatchId) {
      notify('Zadajte match ID', 'warning');
      return;
    }

    setIsGoalLoading(true);
    try {
      const { data, error } = await supabase.rpc('trigger_goal_event', {
        p_match_id: trimmedMatchId,
        p_scoring_team: goalTeam
      });

      if (error) {
        throw error;
      }

      if(data){
        notify('Nový stav: ', data.new_score);
      }

      notify('Gól bol odoslaný', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chyba pri odoslaní gólu';
      notify(message, 'error');
    } finally {
      setIsGoalLoading(false);
    }
  };

  const handleLoadDebugChart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMatchId = debugMatchId.trim();
    if (!trimmedMatchId) {
      notify('Zadajte match ID', 'warning');
      return;
    }

    setIsDebugLoading(true);
    setDebugError(null);
    try {
      const { data, error } = await supabase
        .from('markets')
        .select('id, type, outcomes (id, outcome_slug, label, pool)')
        .eq('match_id', trimmedMatchId);

      if (error) {
        throw error;
      }

      const markets = (data || []) as Array<{ id: string; type?: string | null; outcomes: Outcome[] }>;
      setDebugMarkets(markets);
      setDebugMarketId(markets[0]?.id ?? null);
      if (markets.length === 0) {
        setDebugError('No markets found for this match.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load debug chart';
      setDebugError(message);
    } finally {
      setIsDebugLoading(false);
    }
  };

  const selectedDebugMarket = debugMarkets.find(market => market.id === debugMarketId) ?? debugMarkets[0] ?? null;

  return (
    <>
      <nav className="border-b bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          
          <Link href="/" className="font-bold text-xl tracking-tight text-blue-900 flex items-center gap-2">
             Simulator
          </Link>
        </div>

        <div className="flex items-center gap-4">
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => onRegionChange?.('US')}
              className={clsx(
                "px-4 py-1.5 text-sm font-semibold rounded transition-all flex items-center gap-1.5",
                region === 'US'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
              title="US štýl - ceny v centoch (40¢)"
            >
              🇺🇸 US
            </button>
            <button
              onClick={() => onRegionChange?.('EU')}
              className={clsx(
                "px-4 py-1.5 text-sm font-semibold rounded transition-all flex items-center gap-1.5",
                region === 'EU'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
              title="EU štýl - kurzy (2.50)"
            >
              🇪🇺 EU
            </button>
          </div>

          <div className="relative" ref={goalDropdownRef}>
            <button
              type="button"
              onClick={() => setIsGoalOpen(prev => !prev)}
              className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1 text-sm font-medium"
              title="Simulovať gól"
            >
              <Goal size={18} />
              <span>Gól</span>
            </button>

            {isGoalOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3">
                <form onSubmit={handleTriggerGoal} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                      Match ID
                    </label>
                    <input
                      type="text"
                      value={goalMatchId}
                      onChange={(e) => setGoalMatchId(e.target.value)}
                      placeholder="p_match_id"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                      Scoring team
                    </label>
                    <select
                      value={goalTeam}
                      onChange={(e) => setGoalTeam(e.target.value as 'HOME' | 'AWAY')}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="HOME">HOME</option>
                      <option value="AWAY">AWAY</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isGoalLoading}
                    className="w-full py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
                  >
                    {isGoalLoading ? 'Odosielam...' : 'Simulovať gól'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="relative" ref={debugDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDebugChartOpen(prev => !prev)}
              className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1 text-sm font-medium"
              title="Dev chart"
            >
              <Activity size={18} />
              <span>Dev chart</span>
            </button>

            {isDebugChartOpen && (
              <div className="absolute right-0 mt-2 w-[520px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3 max-h-[80vh] overflow-auto">
                <form onSubmit={handleLoadDebugChart} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                      Match ID
                    </label>
                    <input
                      type="text"
                      value={debugMatchId}
                      onChange={(e) => setDebugMatchId(e.target.value)}
                      placeholder="match_id"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isDebugLoading}
                    className="w-full py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
                  >
                    {isDebugLoading ? 'Loading...' : 'Load chart'}
                  </button>
                </form>

                {debugMarkets.length > 1 && (
                  <div className="mt-3">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                      Market
                    </label>
                    <select
                      value={debugMarketId ?? ''}
                      onChange={(e) => setDebugMarketId(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {debugMarkets.map(market => (
                        <option key={market.id} value={market.id}>
                          {market.type || 'Market'} - {market.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {debugError && (
                  <p className="mt-3 text-xs text-red-500">{debugError}</p>
                )}

                {selectedDebugMarket && selectedDebugMarket.outcomes?.length > 0 ? (
                  <div className="mt-3 h-[420px]">
                    <PriceChart
                      marketId={selectedDebugMarket.id}
                      outcomes={selectedDebugMarket.outcomes}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">
                    Load a match ID to render the chart.
                  </p>
                )}
              </div>
            )}
          </div>

          
          <div className="relative" ref={leaderboardRef}>
            <button
              type="button"
              onClick={() => setIsLeaderboardOpen(prev => !prev)}
              className="text-gray-600 hover:text-yellow-600 transition-colors flex items-center gap-1 text-sm font-medium"
              title="Leaderboard"
            >
              <Trophy size={18} />
              <span>Leaderboard</span>
            </button>

            {isLeaderboardOpen && (
              <div className="absolute right-0 mt-2 w-[600px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-4 max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Trophy size={20} className="text-yellow-500" />
                    Leaderboard
                  </h3>
                  
                  
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {(['GLOBAL', 'MONTHLY', 'WEEKLY'] as PeriodType[]).map((period) => (
                      <button
                        key={period}
                        onClick={() => setLeaderboardPeriod(period)}
                        className={clsx(
                          "px-3 py-1 text-xs font-semibold rounded transition-all",
                          leaderboardPeriod === period
                            ? "bg-yellow-500 text-white shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        )}
                      >
                        {period === 'GLOBAL' ? 'All Time' : period === 'MONTHLY' ? 'Monthly' : 'Weekly'}
                      </button>
                    ))}
                  </div>
                </div>

                {isLeaderboardLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                  </div>
                ) : leaderboardData.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Žiadne dáta</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">#</th>
                          <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Trader</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">Volume</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">Profit</th>
                          <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">ROI</th>
                          <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500">W/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardData.map((entry, idx) => {
                          const profit = parseFloat(entry.net_profit_usdc);
                          const roi = parseFloat(entry.roi_percentage);
                          return (
                            <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-2">
                                <span className={clsx(
                                  "font-bold",
                                  idx === 0 && "text-yellow-500",
                                  idx === 1 && "text-gray-400",
                                  idx === 2 && "text-amber-600"
                                )}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                <span className="font-medium text-gray-900">
                                  {entry.profiles?.username || entry.user_id.slice(0, 8)}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right text-gray-600">
                                ${formatNumber(entry.volume_usdc, 0)}
                              </td>
                              <td className={clsx(
                                "py-2 px-2 text-right font-semibold",
                                profit >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {profit >= 0 ? '+' : ''}${formatNumber(entry.net_profit_usdc, 0)}
                              </td>
                              <td className={clsx(
                                "py-2 px-2 text-right font-semibold",
                                roi >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {formatPercent(entry.roi_percentage)}
                              </td>
                              <td className="py-2 px-2 text-center text-gray-600">
                                <span className="text-green-600">{entry.won_bets}</span>
                                <span className="text-gray-400">/</span>
                                <span className="text-red-600">{entry.total_bets - entry.won_bets}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          
          
          <PortfolioDropdown />
          
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <User size={18} />
            {isAuthenticated ? user?.email || 'Account' : 'Login'}
          </button>
        </div>
      </nav>
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}
