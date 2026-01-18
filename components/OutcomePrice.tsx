import { convertOdds } from '@/utils/math';
import { Region } from './Navbar';

interface OutcomePriceProps {
  probability: number;
  region?: Region;
  className?: string;
  fallback?: string;
}

export function formatOutcomePrice(
  probability: number,
  region: Region,
  fallback: string
): string {
  if (!Number.isFinite(probability) || probability <= 0) {
    return fallback;
  }

  if (region === 'US') {
    return `${Math.round(probability * 100)}¢`;
  }

  return (1 / probability).toFixed(2);
}

function formatMoneyline(probability: number): string | null {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return null;
  }

  return convertOdds(probability, 'US');
}

export default function OutcomePrice({
  probability,
  region = 'EU',
  className,
  fallback = '--'
}: OutcomePriceProps) {
  const display = formatOutcomePrice(probability, region, fallback);
  const moneyline = region === 'US' ? formatMoneyline(probability) : null;

  if (!moneyline || region !== 'US' || display === fallback) {
    return <span className={className}>{display}</span>;
  }

  const wrapperClassName = ['inline-flex flex-col items-center leading-tight', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={wrapperClassName}>
      <span>{display}</span>
      <span className="text-[10px] font-semibold text-gray-500 leading-none">ML {moneyline}</span>
    </span>
  );
}
