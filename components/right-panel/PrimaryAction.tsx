import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import type { Region } from '../Navbar';

interface PrimaryActionProps {
  activeTab: 'buy' | 'sell';
  region: Region;
  betType: 'yes' | 'no';
  disabled: boolean;
  label: string;
  onAction: () => void;
  isAuthenticated: boolean;
}

export default function PrimaryAction({
  activeTab,
  region,
  betType,
  disabled,
  label,
  onAction,
  isAuthenticated
}: PrimaryActionProps) {
  return (
    <>
      <button
        onClick={onAction}
        disabled={disabled}
        className={clsx(
          'w-full py-3 px-4 font-bold text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
          activeTab === 'buy'
            ? (region === 'US' && betType === 'no'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700')
            : 'bg-red-600 hover:bg-red-700'
        )}
      >
        {activeTab === 'buy' && region === 'US' && betType === 'no'
          ? <TrendingDown size={18} />
          : <TrendingUp size={18} />
        }
        {label}
      </button>

      {!isAuthenticated && (
        <p className="text-xs text-center text-gray-500 mt-4">
          {region === 'US' ? 'Please sign in to start trading' : 'Pre obchodovanie sa prihlaste'}
        </p>
      )}
    </>
  );
}
