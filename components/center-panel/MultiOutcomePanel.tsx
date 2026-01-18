import { type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { Lock } from 'lucide-react';
import PriceChart from '../PriceChart';
import OrderBook from '../OrderBook';
import { formatOutcomePrice } from '../OutcomePrice';
import type { Match, SupabaseMatch, Outcome, MultiOutcomeMatchState } from '@/types';
import type { Region } from '../Navbar';

type DisplayOutcome = {
  id: string;
  label: string;
  outcome_slug?: string;
  price: number;
};

interface MultiOutcomePanelProps {
  match: Match;
  supabaseMatch?: SupabaseMatch | null;
  outcomes: Outcome[];
  chartMarketId: string | null;
  liquidityDisplay: string;
  displayOutcomes: DisplayOutcome[];
  sortedOutcomes: DisplayOutcome[];
  positionById: Map<string, number>;
  matchState?: MultiOutcomeMatchState | null;
  activeOutcome?: Outcome;
  activeOutcomeId: string | null;
  betType: 'yes' | 'no';
  region: Region;
  isMarketLocked: boolean;
  unlocking: boolean;
  activeTab: 'chart' | 'orderbook';
  onTabChange: (tab: 'chart' | 'orderbook') => void;
  onUnlockMarket: () => void;
  onSelectOutcome: (outcomeId: string) => void;
  onSelectOutcomeWithBetType: (outcomeId: string, nextBetType: 'yes' | 'no') => void;
  effectiveById: Map<string, number>;
  normalizedById: Map<string, number>;
  totalEffective: number;
}

export default function MultiOutcomePanel({
  match,
  supabaseMatch,
  outcomes,
  chartMarketId,
  liquidityDisplay,
  displayOutcomes,
  sortedOutcomes,
  positionById,
  matchState,
  activeOutcome,
  activeOutcomeId,
  betType,
  region,
  isMarketLocked,
  unlocking,
  activeTab,
  onTabChange,
  onUnlockMarket,
  onSelectOutcome,
  onSelectOutcomeWithBetType,
  effectiveById,
  normalizedById,
  totalEffective
}: MultiOutcomePanelProps) {
  const title = match.title || supabaseMatch?.title || `${match.homeTeam.name} vs ${match.awayTeam.name}`;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {match.status === 'LIVE' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                  LIVE
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                </span>
              )}
              <span className="text-[10px] font-bold text-gray-400 uppercase">{match.sport || 'Event'}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{liquidityDisplay} Liquidity</span>
              <span>~</span>
              <span>{displayOutcomes.length} outcomes</span>
            </div>
            {matchState?.last_event && (
              <div className="mt-2 text-sm text-blue-600 font-medium">
                {matchState.last_event}
              </div>
            )}
          </div>
          {isMarketLocked && (
            <button
              type="button"
              onClick={onUnlockMarket}
              disabled={unlocking}
              className={clsx(
                'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0',
                unlocking
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              <Lock size={12} />
              {unlocking ? 'Unlocking...' : 'Unlock'}
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 px-4">
        <button
          onClick={() => onTabChange('chart')}
          className={clsx(
            'px-4 py-2.5 text-sm font-bold border-b-2 transition-colors',
            activeTab === 'chart'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Price Chart
        </button>
        <button
          onClick={() => onTabChange('orderbook')}
          className={clsx(
            'px-4 py-2.5 text-sm font-bold border-b-2 transition-colors',
            activeTab === 'orderbook'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Order Book
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'chart' ? (
          <div className="p-4 space-y-4">
            <div className="h-[280px]">
              <PriceChart
                marketId={chartMarketId || null}
                outcomes={outcomes}
                homeTeamName={match.homeTeam.name}
                awayTeamName={match.awayTeam.name}
              />
            </div>

            <div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center mb-3 text-xs font-bold text-gray-500 uppercase">
                <span>Outcome</span>
                <span className="text-center">% Chance</span>
                <span className="text-right">{region === 'US' ? 'Yes/No' : 'Odds'}</span>
              </div>
              <div className="space-y-2">
                {sortedOutcomes.map((outcome) => {
                  const isExpanded = activeOutcomeId === outcome.id;
                  const position = positionById.get(outcome.id);
                  const rawYesPrice = Number(outcome.price) || 0;
                  const yesPrice = Math.max(0, Math.min(1, rawYesPrice));
                  const normalizedYes = normalizedById.get(outcome.id) ?? yesPrice;
                  const effectiveYesPrice = effectiveById.get(outcome.id) ?? normalizedYes;
                  const effectiveNoPrice = totalEffective > 0 ? Math.max(0, totalEffective - effectiveYesPrice) : 0;
                  const chancePercent = Math.max(0, Math.min(100, normalizedYes * 100));
                  const yesDisplay = formatOutcomePrice(effectiveYesPrice, region, '--');
                  const noDisplay = formatOutcomePrice(effectiveNoPrice, region, '--');
                  const isYesActive = isExpanded && betType === 'yes';
                  const isNoActive = isExpanded && betType === 'no';
                  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                    if (isMarketLocked) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectOutcome(outcome.id);
                    }
                  };

                  return (
                    <div key={outcome.id}>
                      <div
                        role="button"
                        tabIndex={isMarketLocked ? -1 : 0}
                        aria-expanded={isExpanded}
                        aria-disabled={isMarketLocked}
                        onClick={() => {
                          if (!isMarketLocked) {
                            onSelectOutcome(outcome.id);
                          }
                        }}
                        onKeyDown={handleRowKeyDown}
                        className={clsx(
                          'w-full grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left',
                          isExpanded
                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50',
                          isMarketLocked && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {position !== undefined && (
                            <span
                              className={clsx(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                position === 1 && 'bg-amber-100 text-amber-700',
                                position === 2 && 'bg-gray-100 text-gray-600',
                                position === 3 && 'bg-orange-50 text-orange-600',
                                position > 3 && 'bg-gray-50 text-gray-500'
                              )}
                            >
                              {position}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">
                              {outcome.label}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 text-center tabular-nums">
                          {chancePercent.toFixed(1)}%
                        </span>
                        <div className="flex items-center justify-end gap-2">
                          {region === 'US' ? (
                            <>
                              <button
                                type="button"
                                disabled={isMarketLocked}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!isMarketLocked) {
                                    onSelectOutcomeWithBetType(outcome.id, 'yes');
                                  }
                                }}
                                className={clsx(
                                  'px-2 py-1 text-[11px] font-semibold rounded transition-colors',
                                  isYesActive
                                    ? 'bg-green-600 text-white'
                                    : 'bg-green-50 text-green-700',
                                  isMarketLocked && 'cursor-not-allowed'
                                )}
                              >
                                YES {yesDisplay}
                              </button>
                              <button
                                type="button"
                                disabled={isMarketLocked}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!isMarketLocked) {
                                    onSelectOutcomeWithBetType(outcome.id, 'no');
                                  }
                                }}
                                className={clsx(
                                  'px-2 py-1 text-[11px] font-semibold rounded transition-colors',
                                  isNoActive
                                    ? 'bg-red-600 text-white'
                                    : 'bg-red-50 text-red-700',
                                  isMarketLocked && 'cursor-not-allowed'
                                )}
                              >
                                NO {noDisplay}
                              </button>
                            </>
                          ) : (
                            <span className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-50 text-amber-700">
                              {yesDisplay}
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 ml-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                          <div className="h-[200px]">
                            <PriceChart
                              marketId={chartMarketId || null}
                              outcomes={outcomes}
                              homeTeamName={match.homeTeam.name}
                              awayTeamName={match.awayTeam.name}
                              selectedOutcomeId={outcome.id}
                            />
                          </div>

                          <div>
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Order Book</div>
                            <OrderBook
                              marketId={chartMarketId || null}
                              outcomeId={outcome.id}
                              outcomeName={outcome.label}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {sortedOutcomes.map(outcome => {
                const isActive = activeOutcome?.id === outcome.id;
                const position = positionById.get(outcome.id);
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    onClick={() => onSelectOutcome(outcome.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border flex items-center gap-1',
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {position !== undefined && <span className="opacity-70">#{position}</span>}
                    {outcome.label}
                  </button>
                );
              })}
            </div>
            <OrderBook
              marketId={chartMarketId || null}
              outcomeId={activeOutcome?.id || null}
              outcomeName={activeOutcome?.label || ''}
            />
          </div>
        )}
      </div>
    </div>
  );
}
