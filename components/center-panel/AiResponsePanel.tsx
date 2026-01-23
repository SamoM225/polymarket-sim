'use client';

import { useEffect, useState } from 'react';

interface AiResponsePanelProps {
  matchId?: string | null;
  aiResponse?: string | null;
}

export default function AiResponsePanel({ matchId, aiResponse }: AiResponsePanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(true);
  }, [matchId, aiResponse]);

  if (!aiResponse || !aiResponse.trim()) {
    return null;
  }

  return (
    <div className="px-4 pb-3 border-b border-gray-100">
      <div
        className={[
          'grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100 translate-y-0' : 'grid-rows-[0fr] opacity-0 -translate-y-1'
        ].join(' ')}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="rounded-lg border border-amber-200 bg-amber-50">
            <div className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="text-xs font-semibold text-amber-800">Agent AI predpoklada:</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI prediction"
                className="text-amber-700 hover:text-amber-900 text-xs font-bold"
              >
                ×
              </button>
            </div>
            <div className="px-3 pb-3 text-sm text-amber-900 whitespace-pre-wrap">
              {aiResponse}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
