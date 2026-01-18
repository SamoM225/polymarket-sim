import { clsx } from 'clsx';
import type { Match, SupabaseMatch } from '@/types';
import type { Region } from '../Navbar';

interface RightPanelHeaderProps {
  match: Match;
  supabaseMatch?: SupabaseMatch | null;
  normalizedMarketType: string;
  outcomeSlug: string;
  outcomeName: string;
  region: Region;
  activeTab: 'buy' | 'sell';
  onTabChange: (tab: 'buy' | 'sell') => void;
  badgeText: string;
}

export default function RightPanelHeader({
  match,
  supabaseMatch,
  normalizedMarketType,
  outcomeSlug,
  outcomeName,
  region,
  activeTab,
  onTabChange,
  badgeText
}: RightPanelHeaderProps) {
  const title = normalizedMarketType.includes('MULTI')
    ? (match.title || supabaseMatch?.title || `${match.homeTeam.name} vs ${match.awayTeam.name}`)
    : `${match.homeTeam.name} vs ${match.awayTeam.name}`;

  return (
    <div className="p-4 border-b border-gray-300 bg-white text-gray-900">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs ring-1 ring-gray-300">
          {badgeText}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-800 text-sm truncate">{title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px]',
                outcomeSlug === 'home' ? 'bg-amber-100 text-amber-800' :
                outcomeSlug === 'draw' ? 'bg-blue-100 text-blue-800' :
                outcomeSlug === 'away' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-700'
              )}
            >
              {region === 'EU' && normalizedMarketType.includes('1X2')
                ? (outcomeSlug === 'home' ? '1' : outcomeSlug === 'draw' ? 'X' : '2')
                : ''
              } {outcomeName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end mt-4">
        <div className="flex gap-6 text-sm font-bold border-b border-gray-200 w-full relative">
          <button
            onClick={() => onTabChange('buy')}
            className={clsx(
              'pb-2 border-b-2 transition-all w-12 text-center relative top-[1px]',
              activeTab === 'buy'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            Buy
          </button>
          <button
            onClick={() => onTabChange('sell')}
            className={clsx(
              'pb-2 border-b-2 transition-all w-12 text-center relative top-[1px]',
              activeTab === 'sell'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            Sell
          </button>
        </div>
      </div>
    </div>
  );
}
