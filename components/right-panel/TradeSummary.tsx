import { Lock } from 'lucide-react';
import OutcomePrice from '../OutcomePrice';
import type { Region } from '../Navbar';

interface TradeSummaryProps {
  activeTab: 'buy' | 'sell';
  region: Region;
  quoteLoading: boolean;
  hasValidQuote: boolean;
  quoteShares: number;
  quotePriceLabel: string;
  quotePriceValue: string;
  quoteError: string | null;
  potentialReturn: number;
  netProfit: number;
  roi: number;
  sharesToSellDisplay: number;
  activePrice: number;
  isMarketLocked: boolean;
  estimatedProceeds: number;
  activePositionShares: number;
}

export default function TradeSummary({
  activeTab,
  region,
  quoteLoading,
  hasValidQuote,
  quoteShares,
  quotePriceLabel,
  quotePriceValue,
  quoteError,
  potentialReturn,
  netProfit,
  roi,
  sharesToSellDisplay,
  activePrice,
  isMarketLocked,
  estimatedProceeds,
  activePositionShares
}: TradeSummaryProps) {
  return (
    <div className="bg-gray-50 p-3 rounded-lg mb-4 space-y-2 text-xs">
      {activeTab === 'buy' ? (
        <>
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase">
            <span>{region === 'US' ? 'Quote' : 'Ponuka'}</span>
            {quoteLoading && (
              <span className="text-blue-600">{region === 'US' ? 'Updating...' : 'Aktualizujem...'}</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{region === 'US' ? 'Shares' : 'Akcie'}:</span>
            <span className="font-bold text-gray-900">
              {hasValidQuote ? quoteShares.toFixed(4) : '--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{quotePriceLabel}:</span>
            <span className="font-bold text-gray-900">{quotePriceValue}</span>
          </div>
          {quoteError && (
            <div className="mt-2 text-[11px] text-red-600">
              {region === 'US' ? 'Quote failed' : 'Ponuka zlyhala'}.
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
            <span className="text-gray-600">{region === 'US' ? 'Potential return' : 'Potencialny vynos'}:</span>
            <span className="font-bold text-green-600">
              {hasValidQuote ? `$${potentialReturn.toFixed(2)}` : '--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{region === 'US' ? 'Net profit' : 'Cisty zisk'}:</span>
            <span className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {hasValidQuote ? `$${netProfit.toFixed(2)}` : '--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">ROI:</span>
            <span className={`font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {hasValidQuote ? `${roi.toFixed(1)}%` : '--'}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between">
            <span className="text-gray-600">{region === 'US' ? 'Selling shares' : 'Predavam akcie'}:</span>
            <span className="font-bold text-red-600">{sharesToSellDisplay.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{region === 'US' ? 'Current price' : 'Aktualna cena'}:</span>
            {isMarketLocked ? (
              <Lock size={16} className="text-gray-500" />
            ) : (
              <OutcomePrice probability={activePrice} region={region} className="font-bold text-gray-900" />
            )}
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
            <span className="text-gray-600">{region === 'US' ? 'Est. proceeds' : 'Odhad vynosu'}:</span>
            <span className="font-bold text-green-600">~${estimatedProceeds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{region === 'US' ? 'Remaining shares' : 'Zostane akcie'}:</span>
            <span className="font-bold text-gray-900">
              {Math.max(0, activePositionShares - sharesToSellDisplay).toFixed(4)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
