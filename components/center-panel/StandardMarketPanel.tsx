import { clsx } from 'clsx';
import { Lock } from 'lucide-react';
import PriceChart from '../PriceChart';
import OrderBook from '../OrderBook';
import OutcomePrice from '../OutcomePrice';
import type { Match, Outcome } from '@/types';
import type { Region } from '../Navbar';

type DisplayOutcome = {
  id: string;
  label: string;
  outcome_slug?: string;
  price: number;
};

interface StandardMarketPanelProps {
  match: Match;
  category: 'BINARY' | '1X2';
  region: Region;
  liquidityDisplay: string;
  isMarketLocked: boolean;
  unlocking: boolean;
  activeTab: 'chart' | 'orderbook';
  onTabChange: (tab: 'chart' | 'orderbook') => void;
  onUnlockMarket: () => void;
  selectedOutcomeIds: string[];
  outcomes: Outcome[];
  displayOutcomes: DisplayOutcome[];
  homeOutcome?: DisplayOutcome;
  awayOutcome?: DisplayOutcome;
  drawOutcome?: DisplayOutcome | null;
  activeOutcome?: Outcome;
  chartMarketId: string | null;
  getOutcomeLabel: (outcome?: { outcome_slug?: string; label?: string } | null) => string;
  onSelectOutcome: (outcomeId: string) => void;
  effectiveById: Map<string, number>;
}

export default function StandardMarketPanel({
  match,
  category,
  region,
  liquidityDisplay,
  isMarketLocked,
  unlocking,
  activeTab,
  onTabChange,
  onUnlockMarket,
  selectedOutcomeIds,
  outcomes,
  displayOutcomes,
  homeOutcome,
  awayOutcome,
  drawOutcome,
  activeOutcome,
  chartMarketId,
  getOutcomeLabel,
  onSelectOutcome,
  effectiveById
}: StandardMarketPanelProps) {
  const homeScore = match.currentScore?.home ?? 0;
  const awayScore = match.currentScore?.away ?? 0;
  const applyFee = (price: number, outcomeId?: string) => {
    if (!outcomeId) return price;
    return effectiveById.get(outcomeId) ?? price;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {match.status === 'LIVE' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                LIVE
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </span>
            )}
            {match.simulationMinute !== undefined && (
              <span className="text-xs font-semibold text-gray-600">{match.simulationMinute}&apos;</span>
            )}
            <span className="text-xs text-gray-400">{liquidityDisplay} Liquidity</span>
          </div>
          {isMarketLocked && (
            <button
              type="button"
              onClick={onUnlockMarket}
              disabled={unlocking}
              className={clsx(
                'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                unlocking
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              <Lock size={12} />
              {unlocking ? 'Unlocking...' : 'Unlock Market'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                {match.homeTeam.shortName?.slice(0, 2) || match.homeTeam.name.slice(0, 2)}
              </div>
              <span className="text-sm font-semibold text-gray-800">{match.homeTeam.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                {match.awayTeam.shortName?.slice(0, 2) || match.awayTeam.name.slice(0, 2)}
              </div>
              <span className="text-sm font-semibold text-gray-800">{match.awayTeam.name}</span>
            </div>
          </div>

          {match.status === 'LIVE' && (
            <div className="flex flex-col items-center gap-1 px-4">
              <div className="text-2xl font-bold text-gray-900">{homeScore}</div>
              <div className="w-4 h-0.5 bg-gray-300" />
              <div className="text-2xl font-bold text-gray-900">{awayScore}</div>
            </div>
          )}

          <div className="flex gap-2">
            {category === 'BINARY' ? (
              <>
                {homeOutcome && (
                  <button
                    type="button"
                    disabled={isMarketLocked}
                    onClick={() => onSelectOutcome(homeOutcome.id)}
                    className={clsx(
                      'w-20 h-16 rounded-lg flex flex-col items-center justify-center transition-all border',
                      selectedOutcomeIds.includes(homeOutcome.id)
                        ? 'bg-green-100 border-green-400 ring-1 ring-green-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50',
                      isMarketLocked && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">YES</span>
                    <OutcomePrice
                      probability={applyFee(homeOutcome.price, homeOutcome.id)}
                      region={region}
                      className="text-lg font-bold text-green-600"
                    />
                  </button>
                )}
                {awayOutcome && (
                  <button
                    type="button"
                    disabled={isMarketLocked}
                    onClick={() => onSelectOutcome(awayOutcome.id)}
                    className={clsx(
                      'w-20 h-16 rounded-lg flex flex-col items-center justify-center transition-all border',
                      selectedOutcomeIds.includes(awayOutcome.id)
                        ? 'bg-red-100 border-red-400 ring-1 ring-red-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50',
                      isMarketLocked && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">NO</span>
                    <OutcomePrice
                      probability={applyFee(awayOutcome.price, awayOutcome.id)}
                      region={region}
                      className="text-lg font-bold text-red-600"
                    />
                  </button>
                )}
              </>
            ) : (
              <>
                {homeOutcome && (
                  <button
                    type="button"
                    disabled={isMarketLocked}
                    onClick={() => onSelectOutcome(homeOutcome.id)}
                    className={clsx(
                      'w-16 h-16 rounded-lg flex flex-col items-center justify-center transition-all border',
                      selectedOutcomeIds.includes(homeOutcome.id)
                        ? 'bg-blue-100 border-blue-400 ring-1 ring-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50',
                      isMarketLocked && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <span className="text-[10px] font-semibold text-gray-500">{region === 'US' ? 'HOME' : '1'}</span>
                    <OutcomePrice
                      probability={applyFee(homeOutcome.price, homeOutcome.id)}
                      region={region}
                      className="text-lg font-bold text-blue-600"
                    />
                  </button>
                )}
                {drawOutcome && (
                  <button
                    type="button"
                    disabled={isMarketLocked}
                    onClick={() => onSelectOutcome(drawOutcome.id)}
                    className={clsx(
                      'w-16 h-16 rounded-lg flex flex-col items-center justify-center transition-all border',
                      selectedOutcomeIds.includes(drawOutcome.id)
                        ? 'bg-gray-200 border-gray-400 ring-1 ring-gray-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50',
                      isMarketLocked && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <span className="text-[10px] font-semibold text-gray-500">{region === 'US' ? 'DRAW' : 'X'}</span>
                    <OutcomePrice
                      probability={applyFee(drawOutcome.price, drawOutcome.id)}
                      region={region}
                      className="text-lg font-bold text-gray-600"
                    />
                  </button>
                )}
                {awayOutcome && (
                  <button
                    type="button"
                    disabled={isMarketLocked}
                    onClick={() => onSelectOutcome(awayOutcome.id)}
                    className={clsx(
                      'w-16 h-16 rounded-lg flex flex-col items-center justify-center transition-all border',
                      selectedOutcomeIds.includes(awayOutcome.id)
                        ? 'bg-green-100 border-green-400 ring-1 ring-green-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50',
                      isMarketLocked && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <span className="text-[10px] font-semibold text-gray-500">{region === 'US' ? 'AWAY' : '2'}</span>
                    <OutcomePrice
                      probability={applyFee(awayOutcome.price, awayOutcome.id)}
                      region={region}
                      className="text-lg font-bold text-green-600"
                    />
                  </button>
                )}
              </>
            )}
          </div>
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
          <div className="p-4">
            <div className="h-[400px]">
              <PriceChart
                marketId={chartMarketId || null}
                outcomes={outcomes}
                homeTeamName={match.homeTeam.name}
                awayTeamName={match.awayTeam.name}
              />
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              {displayOutcomes.map(outcome => {
                const isActive = activeOutcome?.id === outcome.id;
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    onClick={() => onSelectOutcome(outcome.id)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-semibold transition-colors border',
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {getOutcomeLabel(outcome)}
                  </button>
                );
              })}
            </div>
            <OrderBook
              marketId={chartMarketId || null}
              outcomeId={activeOutcome?.id || null}
              outcomeName={getOutcomeLabel(activeOutcome)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
