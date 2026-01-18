import { AlertTriangle, X } from 'lucide-react';

interface SlippageState {
  expectedShares: number;
  newShares: number;
  newPrice: number;
  message?: string;
}

interface SlippageModalProps {
  slippageState: SlippageState | null;
  acceptingNewOdds: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function SlippageModal({
  slippageState,
  acceptingNewOdds,
  onClose,
  onAccept
}: SlippageModalProps) {
  if (!slippageState) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <AlertTriangle size={16} className="text-amber-500" />
            <span>Cena sa zmenila</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Cena sa zmenila pocas potvrdenia. Skontrolujte novu ponuku nizsie.
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Ocakavane</span>
            <span className="font-semibold">{slippageState.expectedShares.toFixed(4)} shares</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Aktualna ponuka</span>
            <span className="font-semibold">{slippageState.newShares.toFixed(4)} shares</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Nova priemerna cena</span>
            <span className="font-semibold">${slippageState.newPrice.toFixed(2)}</span>
          </div>
        </div>
        {slippageState.message && (
          <div className="mt-3 text-xs text-gray-500">{slippageState.message}</div>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Zrusit
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={acceptingNewOdds}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {acceptingNewOdds ? 'Prijimam...' : 'Prijat novu cenu'}
          </button>
        </div>
      </div>
    </div>
  );
}
