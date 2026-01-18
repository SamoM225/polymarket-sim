import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, TrendingUp, Percent } from 'lucide-react';
import { usePositions, useMatches } from '@/lib/hooks';
import { useAuth } from '@/lib/AuthContext';
import { useNotification } from '@/lib/NotificationContext';
import { clsx } from 'clsx';
import { calculateOdds } from '@/utils/math';

export default function PortfolioDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSelling, setIsSelling] = useState<string | null>(null);
  const [sellPercents, setSellPercents] = useState<Record<string, number>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { isAuthenticated, user } = useAuth();
  const { positions, loading } = usePositions();
  const { matches: supabaseMatches } = useMatches({ enableRealtime: false, enableOutcomesRealtime: false });
  const { notify } = useNotification();

  const outcomePriceById = useMemo(() => {
    const priceMap = new Map<string, number>();

    supabaseMatches.forEach(match => {
      (match.markets || []).forEach(market => {
        const pricedOutcomes = calculateOdds(
          (market.outcomes || []).map(outcome => ({
            id: outcome.id,
            label: outcome.label,
            pool: outcome.pool,
            outcome_slug: outcome.outcome_slug
          }))
        );

        pricedOutcomes.forEach(outcome => {
          priceMap.set(outcome.id, outcome.price);
        });
      });
    });

    return priceMap;
  }, [supabaseMatches]);

  useEffect(() => {
    const newPercents: Record<string, number> = {};
    positions.forEach((p: any) => {
      if (!sellPercents[p.id]) {
        newPercents[p.id] = 100;
      }
    });
    if (Object.keys(newPercents).length > 0) {
      setSellPercents(prev => ({ ...prev, ...newPercents }));
    }
  }, [positions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated) return null;

  const handleSellPosition = async (positionId: string, totalShares: number, outcomeId: string, marketId: string) => {
    const percent = sellPercents[positionId] || 100;
    const sharesToSell = totalShares * (percent / 100);
    
    if (!sharesToSell || sharesToSell <= 0) {
      notify('Nemôžeš predať 0 akcií', 'error');
      return;
    }

    setIsSelling(positionId);
    
    try {
      const response = await fetch('/api/sell-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcomeId,
          sharesToSell: sharesToSell,
          marketId,
          userId: user?.id
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      notify(`✓ Predané ${sharesToSell.toFixed(4)} akcií za ${data.data?.proceeds?.toFixed(2) || '...'} USDC`, 'success');
      
      setSellPercents(prev => ({ ...prev, [positionId]: 100 }));
      
      
      if (percent === 100) {
        setIsOpen(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Chyba pri predaji';
      notify(errorMessage, 'error');
      console.error('Sell error:', error);
    } finally {
      setIsSelling(null);
    }
  };

  const openPositions = positions.filter((p: any) => (p.shares || 0) > 0);

  return (
    <div ref={dropdownRef} className="relative">
      
      <button
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1 text-sm font-medium relative"
        title="Otvárané pozície"
      >
        <TrendingUp size={18} />
        <span>Portfolio</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        
        
        {openPositions.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {openPositions.length}
          </span>
        )}
      </button>

      
      {isOpen && (
        <div className="absolute right-0 mt-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
             onMouseEnter={() => setIsOpen(true)}
             onMouseLeave={() => setIsOpen(false)}>
          
          
          <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Moje pozície</h3>
            {openPositions.length === 0 && (
              <p className="text-xs text-gray-500">Nemáte otvárané žiadne pozície</p>
            )}
          </div>

          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-center text-gray-500 text-sm">Načítavanie...</div>
            ) : openPositions.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">
                Zatiaľ žiadne otvorené pozície
              </div>
            ) : (
              openPositions.map((position: any) => {
                const outcomeLabel = position.outcomes?.label || 'Unknown';
                const marketTitle = position.markets?.matches?.title || 'Unknown Market';
                const shares = position.shares || 0;
                const amountSpent = position.amount_spent || 0;
                const avgPrice = position.avg_price || (amountSpent / shares) || 0;
                const currentPrice = outcomePriceById.get(position.outcome_id) ?? avgPrice;
                const currentValue = shares * currentPrice;
                const profitLoss = currentValue - amountSpent;
                const profitLossPercent = amountSpent > 0 ? (profitLoss / amountSpent) * 100 : 0;

                return (
                  <div
                    key={position.id}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    
                    <div className="mb-2">
                      <div className="text-sm font-medium text-gray-900">{outcomeLabel}</div>
                      <div className="text-xs text-gray-500">{marketTitle}</div>
                    </div>

                    
                    <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                      <div>
                        <span className="text-gray-600">Akcie: </span>
                        <span className="font-semibold text-gray-900">{shares.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Priem. cena: </span>
                        <span className="font-semibold text-gray-900">{(avgPrice * 100).toFixed(1)}¢</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Investované: </span>
                        <span className="font-semibold text-blue-600">${amountSpent.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Aktualna hodnota: </span>
                        <span className="font-semibold text-green-600">${currentValue.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    
                    <div className={`text-xs mb-3 p-1.5 rounded ${profitLoss >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      <span className="font-semibold">
                        {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} USDC ({profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(1)}%)
                      </span>
                    </div>

                    
                    <div className="mb-2">
                      <div className="flex gap-1 mb-2">
                        {[25, 50, 75, 100].map(pct => (
                          <button
                            key={pct}
                            onClick={() => setSellPercents(prev => ({ ...prev, [position.id]: pct }))}
                            className={clsx(
                              "flex-1 px-2 py-1 text-[10px] font-bold rounded transition-colors",
                              (sellPercents[position.id] || 100) === pct
                                ? "bg-red-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500 text-center">
                        Predaj: {((sellPercents[position.id] || 100) / 100 * shares).toFixed(4)} akcií
                      </div>
                    </div>

                    
                    <button
                      onClick={() => handleSellPosition(
                        position.id,
                        shares,
                        position.outcome_id,
                        position.market_id
                      )}
                      disabled={isSelling === position.id}
                      className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-medium rounded transition-colors"
                    >
                      {isSelling === position.id ? 'Predáva...' : `Predaj ${sellPercents[position.id] || 100}%`}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
