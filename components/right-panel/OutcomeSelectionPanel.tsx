import { TrendingUp, TrendingDown, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import OutcomePrice from '../OutcomePrice';
import type { Region } from '../Navbar';

interface OutcomeSelectionPanelProps {
  region: Region;
  activeTab: 'buy' | 'sell';
  betType: 'yes' | 'no';
  onBetTypeChange: (betType: 'yes' | 'no') => void;
  isMarketLocked: boolean;
  yesPrice: number;
  noPrice: number;
  activePrice: number;
  outcomeName: string;
  isMultiSelection: boolean;
  selectedOutcomeLabelList: string;
  noBetTargetsLabel: string;
}

export default function OutcomeSelectionPanel({
  region,
  activeTab,
  betType,
  onBetTypeChange,
  isMarketLocked,
  yesPrice,
  noPrice,
  activePrice,
  outcomeName,
  isMultiSelection,
  selectedOutcomeLabelList,
  noBetTargetsLabel
}: OutcomeSelectionPanelProps) {
  return (
    <>
      {region === 'US' && (
        <div className="mb-4">
          <div className="text-xs font-bold text-gray-500 uppercase mb-2">
            {activeTab === 'buy' ? 'Buy Type' : 'Sell Type'}
          </div>
          <div className="flex gap-2">
            <button
              disabled={isMarketLocked}
              onClick={() => onBetTypeChange('yes')}
              className={clsx(
                'flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex flex-col items-center justify-center border-2 disabled:opacity-60 disabled:cursor-not-allowed',
                betType === 'yes'
                  ? 'bg-green-100 border-green-500 text-green-900 shadow-md'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={16} />
                <span className="uppercase text-xs font-bold tracking-widest">YES</span>
              </div>
              {isMarketLocked ? (
                <Lock size={18} className="text-gray-500" />
              ) : (
                <OutcomePrice
                  probability={yesPrice}
                  region={region}
                  className="text-lg font-bold text-green-600"
                />
              )}
              <span className="text-[10px] text-gray-500">{outcomeName} wins</span>
            </button>
            <button
              disabled={isMarketLocked}
              onClick={() => onBetTypeChange('no')}
              className={clsx(
                'flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex flex-col items-center justify-center border-2 disabled:opacity-60 disabled:cursor-not-allowed',
                betType === 'no'
                  ? 'bg-red-100 border-red-500 text-red-900 shadow-md'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown size={16} />
                <span className="uppercase text-xs font-bold tracking-widest">NO</span>
              </div>
              {isMarketLocked ? (
                <Lock size={18} className="text-gray-500" />
              ) : (
                <OutcomePrice
                  probability={noPrice}
                  region={region}
                  className="text-lg font-bold text-red-600"
                />
              )}
              <span className="text-[10px] text-gray-500">{outcomeName} doesn&apos;t win</span>
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
              {region === 'US' ? 'Selected' : 'Vybrany vysledok'}
            </div>
            <div className="text-lg font-bold text-gray-900">
              {region === 'US' && betType === 'no'
                ? `NO ${outcomeName}`
                : region === 'US'
                  ? `YES ${outcomeName}`
                  : outcomeName
              }
            </div>
            {isMultiSelection && (
              <div className="text-xs text-gray-500 mt-1">
                Selected outcomes: {selectedOutcomeLabelList} (last selected trades)
              </div>
            )}
            {region === 'US' && betType === 'no' && noBetTargetsLabel && (
              <div className="text-xs text-gray-500 mt-1">
                {activeTab === 'buy' ? 'Buys' : 'Sells'}: {noBetTargetsLabel}
              </div>
            )}
          </div>
          <div className="text-right">
            {region === 'US' ? (
              <>
                {isMarketLocked ? (
                  <Lock size={22} className="text-gray-500" />
                ) : (
                  <OutcomePrice
                    probability={activePrice}
                    region={region}
                    className={clsx(
                      'text-2xl font-bold',
                      betType === 'yes' ? 'text-green-600' : 'text-red-600'
                    )}
                  />
                )}
                <div className="text-xs text-gray-500">per share</div>
              </>
            ) : (
              <>
                {isMarketLocked ? (
                  <Lock size={22} className="text-gray-500" />
                ) : (
                  <OutcomePrice probability={yesPrice} region={region} className="text-2xl font-bold text-amber-700" />
                )}
                <div className="text-xs text-gray-500">kurz</div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
