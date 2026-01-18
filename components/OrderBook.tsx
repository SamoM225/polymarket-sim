'use client';

import { useOrderBook } from '@/lib/hooks';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

interface OrderBookProps {
  marketId: string | null;
  outcomeId: string | null;
  outcomeName?: string;
}

export default function OrderBook({ marketId, outcomeId, outcomeName = 'Outcome' }: OrderBookProps) {
  const { bids, asks, loading, error } = useOrderBook(marketId, outcomeId);

  if (!marketId || !outcomeId) {
    return (
      <div className="w-full h-full min-h-[300px] bg-white rounded-lg border border-gray-200 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Vyber zápas a výsledok</p>
          <p className="text-sm text-gray-400">pre zobrazenie order book</p>
        </div>
      </div>
    );
  }

  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const bestAsk = asks.length > 0 ? asks[0].price : 0;
  const spread = bestBid > 0 && bestAsk > 0 
    ? ((bestAsk - bestBid) * 100).toFixed(1)
    : 'N/A';

  const maxSize = Math.max(
    ...(bids.length > 0 ? bids.map(b => b.size) : [1]),
    ...(asks.length > 0 ? asks.map(a => a.size) : [1])
  );

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-4">
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{outcomeName} Order Book</h3>
        {(bids.length > 0 || asks.length > 0) && (
          <div className="text-xs text-gray-500">
            Spread: <span className="font-semibold text-gray-700">{spread}¢</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm">Načítavam...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-48 text-red-500">
          <p className="text-sm">{error}</p>
        </div>
      ) : (bids.length > 0 || asks.length > 0) ? (
        <div className="grid grid-cols-2 gap-3">
          
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-green-600">
              <TrendingUp size={12} />
              <span className="text-xs font-semibold">Nákupy (Bids)</span>
            </div>
            <div className="space-y-1">
              {bids.length > 0 ? (
                bids.slice(0, 8).map((bid, idx) => {
                  const depthWidth = (bid.size / maxSize) * 100;
                  const priceInCents = Math.round(bid.price * 100);
                  return (
                    <div 
                      key={idx} 
                      className="relative flex items-center justify-between py-1.5 px-2 rounded text-sm"
                    >
                      
                      <div 
                        className="absolute inset-y-0 left-0 bg-green-100 rounded"
                        style={{ width: `${depthWidth}%` }}
                      />
                      <span className="relative font-semibold text-green-700">{priceInCents}¢</span>
                      <span className="relative text-gray-600">{bid.size.toFixed(0)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 py-4 text-xs">Žiadne</div>
              )}
            </div>
          </div>

          
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-red-600">
              <TrendingDown size={12} />
              <span className="text-xs font-semibold">Predaje (Asks)</span>
            </div>
            <div className="space-y-1">
              {asks.length > 0 ? (
                asks.slice(0, 8).map((ask, idx) => {
                  const depthWidth = (ask.size / maxSize) * 100;
                  const priceInCents = Math.round(ask.price * 100);
                  return (
                    <div 
                      key={idx} 
                      className="relative flex items-center justify-between py-1.5 px-2 rounded text-sm"
                    >
                      
                      <div 
                        className="absolute inset-y-0 right-0 bg-red-100 rounded"
                        style={{ width: `${depthWidth}%` }}
                      />
                      <span className="relative font-semibold text-red-700">{priceInCents}¢</span>
                      <span className="relative text-gray-600">{ask.size.toFixed(0)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 py-4 text-xs">Žiadne</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Žiadne dáta</p>
            <p className="text-xs opacity-70">Zatiaľ neboli vykonané obchody</p>
          </div>
        </div>
      )}
    </div>
  );
}
