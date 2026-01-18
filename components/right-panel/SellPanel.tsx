import { clsx } from 'clsx';
import type { Region } from '../Navbar';

interface SellPanelProps {
  region: Region;
  isNoBet: boolean;
  activePositionShares: number;
  activePositionAvgPrice: number;
  activePositionAmountSpent: number;
  sharesToSellDisplay: number;
  sellPercent: number;
  onSellPercentChange: (value: number) => void;
  sellPercentOptions: number[];
  isMarketLocked: boolean;
}

export default function SellPanel({
  region,
  isNoBet,
  activePositionShares,
  activePositionAvgPrice,
  activePositionAmountSpent,
  sharesToSellDisplay,
  sellPercent,
  onSellPercentChange,
  sellPercentOptions,
  isMarketLocked
}: SellPanelProps) {
  return (
    <div className="mb-4">
      {activePositionShares > 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-xs font-bold text-blue-800 uppercase mb-2">
            {region === 'US' ? (isNoBet ? 'Your NO Position' : 'Your Position') : 'Tvoja pozicia'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-600">{region === 'US' ? 'Shares' : 'Akcie'}: </span>
              <span className="font-bold text-gray-900">{activePositionShares.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-gray-600">{region === 'US' ? 'Avg. price' : 'Priem. cena'}: </span>
              <span className="font-bold text-gray-900">
                {region === 'US'
                  ? `${(activePositionAvgPrice * 100).toFixed(1)}c`
                  : (activePositionAvgPrice > 0 ? (1 / activePositionAvgPrice).toFixed(2) : '0.00')
                }
              </span>
            </div>
            <div>
              <span className="text-gray-600">{region === 'US' ? 'Invested' : 'Investovane'}: </span>
              <span className="font-bold text-blue-600">${activePositionAmountSpent.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">{region === 'US' ? 'Pot. return' : 'Pot. vynos'}: </span>
              <span className="font-bold text-green-600">${activePositionShares.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 mb-4 text-center">
          <div className="text-gray-500 text-sm">
            {region === 'US' ? 'No shares to sell' : 'Nemas ziadne akcie na predaj'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {region === 'US' ? 'Buy shares first' : 'Najprv nakup akcie'}
          </div>
        </div>
      )}

      {activePositionShares > 0 && (
        <>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-gray-600 uppercase">
              {region === 'US' ? 'How much to sell?' : 'Kolko predat?'}
            </label>
            <div className="text-xs font-medium text-red-600">
              {sellPercent}% = {sharesToSellDisplay.toFixed(4)} {region === 'US' ? 'shares' : 'akcii'}
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            {sellPercentOptions.map(pct => (
              <button
                key={pct}
                onClick={() => onSellPercentChange(pct)}
                disabled={isMarketLocked}
                className={clsx(
                  'flex-1 px-3 py-2 text-xs font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  sellPercent === pct
                    ? 'bg-red-600 text-white'
                    : 'text-red-600 border border-red-200 hover:bg-red-50'
                )}
              >
                {pct}%
              </button>
            ))}
          </div>

          <input
            type="range"
            min="1"
            max="100"
            value={sellPercent}
            onChange={(e) => onSellPercentChange(parseInt(e.target.value))}
            disabled={isMarketLocked}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </>
      )}
    </div>
  );
}
