import { DollarSign } from 'lucide-react';
import { clsx } from 'clsx';
import type { Region } from '../Navbar';

interface BuyPanelProps {
  region: Region;
  balance: number;
  isCooldownActive: boolean;
  cooldownSeconds: number;
  pendingBuy: boolean;
  countdownSeconds: number;
  isMarketSuspended: boolean;
  maxAllowedBet: number;
  noCooldownLimit: number;
  willTriggerCooldown: boolean;
  predictedCooldownSeconds: number;
  amount: string;
  numAmount: number;
  onAmountChange: (value: string) => void;
  onQuickAdd: (value: number) => void;
  onClear: () => void;
  quickAmounts: number[];
  isBuyInteractionDisabled: boolean;
}

export default function BuyPanel({
  region,
  balance,
  isCooldownActive,
  cooldownSeconds,
  pendingBuy,
  countdownSeconds,
  isMarketSuspended,
  maxAllowedBet,
  noCooldownLimit,
  willTriggerCooldown,
  predictedCooldownSeconds,
  amount,
  numAmount,
  onAmountChange,
  onQuickAdd,
  onClear,
  quickAmounts,
  isBuyInteractionDisabled
}: BuyPanelProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-bold text-gray-600 uppercase">
          {region === 'US' ? 'Amount (USDC)' : 'Suma (USDC)'}
        </label>
        <div className="text-xs font-medium text-gray-600">
          {region === 'US' ? 'Balance' : 'Zostatok'}: ${balance.toFixed(2)}
        </div>
      </div>
      {isCooldownActive && (
        <div className="mb-2 text-xs text-red-600">
          Cooldown: {cooldownSeconds}s
        </div>
      )}
      {pendingBuy && (
        <div className="mb-3 flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>Processing in {countdownSeconds}s</span>
        </div>
      )}
      <div className="flex justify-between items-center mb-2 text-xs">
        <span className="text-gray-500">{region === 'US' ? 'Max bet' : 'Max stavka'}:</span>
        <span
          className={clsx(
            'font-semibold',
            isMarketSuspended || maxAllowedBet <= 0
              ? 'text-gray-500'
              : numAmount > maxAllowedBet
                ? 'text-red-600'
                : 'text-gray-700'
          )}
        >
          {isMarketSuspended || maxAllowedBet <= 0 ? 'Suspended' : `$${maxAllowedBet.toFixed(2)}`}
        </span>
      </div>
      <div className="flex justify-between items-center mb-1 text-xs">
        <span className="text-gray-500">{region === 'US' ? 'No cooldown up to' : 'Bez cooldownu do'}:</span>
        <span className={clsx('font-semibold', isMarketSuspended || maxAllowedBet <= 0 ? 'text-gray-500' : 'text-gray-700')}>
          {isMarketSuspended || maxAllowedBet <= 0 ? 'Suspended' : `$${noCooldownLimit.toFixed(2)}`}
        </span>
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">{region === 'US' ? 'Cooldown after this bet' : 'Cooldown po stave'}:</span>
        <span className={clsx('font-semibold', willTriggerCooldown ? 'text-amber-600' : 'text-gray-700')}>
          {willTriggerCooldown ? `${predictedCooldownSeconds}s` : (region === 'US' ? 'None' : 'Ziadny')}
        </span>
      </div>

      <div className="relative mb-3">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <DollarSign size={18} />
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          disabled={isBuyInteractionDisabled}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {quickAmounts.map(amt => (
          <button
            key={amt}
            onClick={() => onQuickAdd(amt)}
            disabled={isBuyInteractionDisabled}
            className="flex-1 px-3 py-2 text-xs font-bold text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            +${amt}
          </button>
        ))}
        <button
          onClick={onClear}
          disabled={isBuyInteractionDisabled}
          className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
