import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { Trophy, Lock, Goal, Volleyball } from 'lucide-react';
import { Match, MultiOutcomeMatchState } from '../types';
import { clsx } from 'clsx';
import { Region } from './Navbar';
import OutcomePrice from './OutcomePrice';

interface LeftPanelProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  matches: Match[];
  onMatchSelect: (match: Match) => void;
  selectedMatchId?: string;
  region?: Region;
  marketStatusByMatchId?: Record<string, string | undefined>;
  sports: string[];
  selectedSport: string;
  onSportSelect: (sport: string) => void;
}

export default function LeftPanel({
  currentDate,
  onDateChange,
  matches,
  onMatchSelect,
  selectedMatchId,
  region = 'EU',
  marketStatusByMatchId,
  sports,
  selectedSport,
  onSportSelect
}: LeftPanelProps) {
  const probabilityFromCents = (priceInCents: number) => {
    if (priceInCents <= 0) return 0;
    return priceInCents / 100;
  };

  const normalizeSport = (sport: string) => sport.toLowerCase().trim();
  const renderSportIcon = (sport: string) => {
    const key = normalizeSport(sport);
    if (key === 'all') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </svg>
      );
    }
    if (key.includes('soccer') || (key.includes('football') && !key.includes('american'))) {
      return <Goal size={16} />;
    }
    if (key.includes('volleyball')) {
      return <Volleyball size={16} />;
    }
    if (key.includes('basketball')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <path d="M12 4c2.5 2.2 4 5 4 8s-1.5 5.8-4 8" />
          <path d="M12 4c-2.5 2.2-4 5-4 8s1.5 5.8 4 8" />
        </svg>
      );
    }
    if (key.includes('tennis')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="6" />
          <path d="M7 7c2 3 6 5 10 5" />
          <path d="M14 14l6 6" />
        </svg>
      );
    }
    if (key.includes('baseball')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="8" />
          <path d="M7 6c1.5 2 1.5 4 0 6" />
          <path d="M17 12c-1.5 2-1.5 4 0 6" />
        </svg>
      );
    }
    if (key.includes('hockey')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="14" r="3.5" />
          <path d="M12 6l7 12" />
          <path d="M16 18h5" />
        </svg>
      );
    }
    return <Trophy size={16} />;
  };

  const startDay = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDay, i));

  return (
    <div className="flex flex-col h-full bg-gray-50">
      
      <div className="p-4 bg-white border-b border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['all', ...sports].map((sport) => {
            const isSelected = selectedSport === sport;
            return (
              <button
                key={sport}
                type="button"
                onClick={() => onSportSelect(sport)}
                title={sport === 'all' ? 'All sports' : sport}
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center border transition-colors",
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                )}
              >
                {renderSportIcon(sport)}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center mb-2">
           <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</h2>
           <span className="text-[10px] text-gray-400">{format(weekDays[0], 'd')} - {format(weekDays[6], 'd MMM')}</span>
        </div>
        <div className="flex justify-between gap-1">
          {weekDays.map((date) => {
            const isSelected = isSameDay(date, currentDate);
            return (
              <button
                key={date.toISOString()}
                onClick={() => onDateChange(date)}
                className={clsx(
                  "flex flex-col items-center justify-center p-1 rounded-lg transition-all min-w-[2.5rem]",
                  isSelected 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "hover:bg-gray-100 text-gray-600"
                )}
              >
                <span className="text-[10px] font-medium opacity-80 uppercase">{format(date, 'MMM')}</span>
                <span className="text-sm font-bold">{format(date, 'd')}</span>
              </button>
            );
          })}
        </div>
      </div>

      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Trophy size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No matches on this day</p>
          </div>
        ) : (
          matches.map((match) => {
            const marketStatus = marketStatusByMatchId?.[match.id];
            const isMarketLocked = marketStatus ? marketStatus !== 'OPEN' : false;
            const marketType = match.marketType ?? (match.league.hasDraw ? '1X2' : 'BINARY');
            const normalizedType = (marketType || '').toUpperCase();
            const isOneXTwo = normalizedType === '1X2';
            const isMultiMarket = normalizedType.includes('MULTI');
            const outcomeSummaries = match.outcomes || [];
            const outcomePriceBySlug = new Map(outcomeSummaries.map(outcome => [outcome.slug, outcome.price]));
            const getOutcomeProbability = (slug: string, fallbackCents: number) => {
              const price = outcomePriceBySlug.get(slug);
              if (price !== undefined) return price;
              return probabilityFromCents(fallbackCents);
            };
            const visibleOutcomes = outcomeSummaries.length > 0
              ? outcomeSummaries
              : [
                  { id: 'home', slug: 'home', label: match.homeTeam.name, price: probabilityFromCents(match.prices?.home.yes || 0) },
                  { id: 'draw', slug: 'draw', label: 'Draw', price: probabilityFromCents(match.prices?.draw?.yes || 0) },
                  { id: 'away', slug: 'away', label: match.awayTeam.name, price: probabilityFromCents(match.prices?.away.yes || 0) }
                ].filter(outcome => outcome.price > 0);
            
            const positionById = new Map<string, number>();
            const matchState = match.matchState as MultiOutcomeMatchState | null;
            (matchState?.positions || []).forEach((outcomeId, idx) => {
              positionById.set(outcomeId, idx + 1);
            });
            
            const topOutcomes = isMultiMarket 
              ? [...visibleOutcomes].sort((a, b) => {
                  const posA = positionById.get(a.id);
                  const posB = positionById.get(b.id);
                  if (posA !== undefined && posB !== undefined) return posA - posB;
                  if (posA !== undefined) return -1;
                  if (posB !== undefined) return 1;
                  return b.price - a.price;
                }).slice(0, 3)
              : visibleOutcomes;

            return (
              <div
                key={match.id}
                onClick={() => onMatchSelect(match)}
                className={clsx(
                  "p-3 rounded-lg cursor-pointer border transition-all hover:shadow-md",
                  selectedMatchId === match.id
                    ? "bg-blue-50 border-blue-200 ring-1 ring-blue-300"
                    : "bg-white border-gray-100 hover:border-gray-200"
                )}
              >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{match.sport || (isMultiMarket ? 'Event' : match.league.name !== 'Polymarket' ? match.league.name : '')}</span>
                </div>
                {match.status === 'LIVE' && (
                  <div className="flex items-center gap-1.5">
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm animate-pulse">
                      LIVE
                    </span>
                    {match.simulationMinute !== undefined && (
                      <span className="text-[10px] text-gray-500">{match.simulationMinute}'</span>
                    )}
                  </div>
                )}
                {match.status === 'SCHEDULED' && (
                  <span className="text-[10px] text-gray-400" suppressHydrationWarning>
                    {format(new Date(match.startTime), 'HH:mm')}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                {isOneXTwo ? (
                  <>
                    
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-2 overflow-hidden">
                         <div className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden shrink-0" />
                         <span className="text-sm font-medium text-gray-800 truncate">{match.homeTeam.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className={clsx(
                            "text-xs font-bold px-2 py-0.5 rounded",
                            region === 'US' 
                              ? "bg-green-100 text-green-700" 
                              : "bg-amber-100 text-amber-700"
                          )}>
                            {isMarketLocked ? (
                              <Lock size={12} className="text-gray-500" />
                            ) : (
                              <OutcomePrice
                                probability={getOutcomeProbability('home', match.prices?.home.yes || 0)}
                                region={region}
                              />
                            )}
                          </span>
                          <span className="text-sm font-bold text-gray-900 w-4 text-center">{match.currentScore?.home ?? '-'}</span>
                       </div>
                    </div>
                    
                    
                    {match.league.hasDraw && getOutcomeProbability('draw', match.prices?.draw?.yes || 0) > 0 && (
                      <div className="flex justify-between items-center pl-6">
                        <span className="text-xs text-gray-400">Draw</span>
                         <div className="flex items-center gap-2">
                            <span className={clsx(
                              "text-xs font-bold px-2 py-0.5 rounded",
                              region === 'US' 
                                ? "bg-gray-100 text-gray-600" 
                                : "bg-blue-100 text-blue-600"
                            )}>
                              {isMarketLocked ? (
                                <Lock size={12} className="text-gray-500" />
                              ) : (
                                <OutcomePrice
                                  probability={getOutcomeProbability('draw', match.prices?.draw?.yes || 0)}
                                  region={region}
                                />
                              )}
                            </span>
                            <span className="w-4"></span>
                         </div>
                      </div>
                    )}

                    
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-2 overflow-hidden">
                         <div className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden shrink-0" />
                         <span className="text-sm font-medium text-gray-800 truncate">{match.awayTeam.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className={clsx(
                            "text-xs font-bold px-2 py-0.5 rounded",
                            region === 'US' 
                              ? "bg-red-100 text-red-700" 
                              : "bg-green-100 text-green-700"
                          )}>
                             {isMarketLocked ? (
                               <Lock size={12} className="text-gray-500" />
                             ) : (
                               <OutcomePrice
                                 probability={getOutcomeProbability('away', match.prices?.away.yes || 0)}
                                 region={region}
                               />
                             )}
                          </span>
                          <span className="text-sm font-bold text-gray-900 w-4 text-center">{match.currentScore?.away ?? '-'}</span>
                       </div>
                    </div>
                  </>
                ) : isMultiMarket ? (
                  <>
                    
                    <div className="mb-1">
                      <span className="text-sm font-semibold text-gray-800 line-clamp-2">
                        {match.title || `${match.homeTeam.name}`}
                      </span>
                    </div>
                    {topOutcomes.map((outcome) => {
                      const position = positionById.get(outcome.id);
                      const displayPos = position ?? (topOutcomes.indexOf(outcome) + 1);
                      return (
                        <div key={outcome.id} className="flex justify-between items-center">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className={clsx(
                              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                              displayPos === 1 ? "bg-amber-100 text-amber-700" :
                              displayPos === 2 ? "bg-gray-100 text-gray-600" :
                              displayPos === 3 ? "bg-orange-50 text-orange-600" :
                              "bg-gray-50 text-gray-500"
                            )}>
                              {displayPos}
                            </span>
                            <span className="text-xs font-medium text-gray-700 truncate">{outcome.label}</span>
                          </div>
                          <span className={clsx(
                            "text-xs font-bold px-2 py-0.5 rounded",
                            displayPos === 1 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"
                          )}>
                            {isMarketLocked ? (
                              <Lock size={12} className="text-gray-500" />
                            ) : (
                              <OutcomePrice probability={outcome.price} region={region} />
                            )}
                          </span>
                        </div>
                      );
                    })}
                    {visibleOutcomes.length > 3 && (
                      <div className="text-[10px] text-gray-400 text-right">+{visibleOutcomes.length - 3} more</div>
                    )}
                  </>
                ) : (
                  <>
                    {topOutcomes.slice(0, 3).map(outcome => (
                      <div key={outcome.id} className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[160px]">{outcome.label}</span>
                        <span className={clsx(
                          "text-xs font-bold px-2 py-0.5 rounded",
                          "bg-gray-100 text-gray-700"
                        )}>
                          {isMarketLocked ? (
                            <Lock size={12} className="text-gray-500" />
                          ) : (
                            <OutcomePrice probability={outcome.price} region={region} />
                          )}
                        </span>
                      </div>
                    ))}
                    {visibleOutcomes.length > 3 && (
                      <div className="text-[10px] text-gray-400">+{visibleOutcomes.length - 3} more outcomes</div>
                    )}
                  </>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
