'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X } from 'lucide-react';

interface AiResponsePanelProps {
  matchId?: string | null;
  aiResponse?: string | null | Record<string, unknown> | Array<Record<string, unknown>>;
}

type AiResponseEntry = {
  event?: string;
  response?: string;
  timestamp?: string;
};

const formatEventLabel = (event?: string) => {
  if (!event) return 'AI analýza';
  const clean = event.replace(/_/g, ' ').trim();
  return clean ? clean[0].toUpperCase() + clean.slice(1) : 'AI analýza';
};

const formatTimestamp = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const toEntry = (raw: any, fallbackResponse?: string): AiResponseEntry => {
  if (typeof raw === 'string') {
    return { response: raw };
  }
  if (!raw || typeof raw !== 'object') {
    return { response: fallbackResponse };
  }
  const response =
    typeof raw.response === 'string'
      ? raw.response
      : typeof raw.message === 'string'
        ? raw.message
        : fallbackResponse;
  return {
    event: typeof raw.event === 'string' ? raw.event : undefined,
    response,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined
  };
};

const parseAiResponse = (value?: unknown): AiResponseEntry[] => {
  if (value === null || value === undefined) return [];

  if (typeof value === 'string') {
    if (!value.trim()) return [];
    const trimmed = value.trim();

    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map(entry => toEntry(entry))
            .filter(entry => entry.response && entry.response.trim());
        }
        if (parsed && typeof parsed === 'object') {
          const entry = toEntry(parsed);
          return entry.response && entry.response.trim() ? [entry] : [];
        }
      } catch {
        return [{ response: trimmed }];
      }
    }

    return [{ response: trimmed }];
  }

  if (Array.isArray(value)) {
    return value
      .map(entry => toEntry(entry))
      .filter(entry => entry.response && entry.response.trim());
  }

  if (typeof value === 'object') {
    const entry = toEntry(value);
    return entry.response && entry.response.trim() ? [entry] : [];
  }

  return [];
};

const sortEntries = (entries: AiResponseEntry[]) => {
  return [...entries].sort((a, b) => {
    const at = a.timestamp ? new Date(a.timestamp).getTime() : Number.NaN;
    const bt = b.timestamp ? new Date(b.timestamp).getTime() : Number.NaN;
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
    if (Number.isNaN(at)) return 1;
    if (Number.isNaN(bt)) return -1;
    return bt - at;
  });
};

const markdownComponents = {
  p: ({ children }: { children: ReactNode }) => (
    <p className="text-sm text-amber-900 leading-relaxed">{children}</p>
  ),
  strong: ({ children }: { children: ReactNode }) => (
    <strong className="font-semibold text-amber-900">{children}</strong>
  ),
  em: ({ children }: { children: ReactNode }) => (
    <em className="italic text-amber-900">{children}</em>
  ),
  ul: ({ children }: { children: ReactNode }) => (
    <ul className="list-disc list-inside space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children: ReactNode }) => (
    <ol className="list-decimal list-inside space-y-1">{children}</ol>
  ),
  li: ({ children }: { children: ReactNode }) => (
    <li className="text-sm text-amber-900">{children}</li>
  ),
  code: ({ children }: { children: ReactNode }) => (
    <code className="rounded bg-amber-100/70 px-1 py-0.5 text-[12px] text-amber-900">{children}</code>
  ),
  a: ({ href, children }: { href?: string; children: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
    >
      {children}
    </a>
  )
};

const renderMarkdown = (content: string) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={markdownComponents}>
    {content}
  </ReactMarkdown>
);

export default function AiResponsePanel({ matchId, aiResponse }: AiResponsePanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const entries = useMemo(() => sortEntries(parseAiResponse(aiResponse)), [aiResponse]);
  const latestEntry = entries.length > 0 ? entries[0] : null;

  useEffect(() => {
    setIsOpen(true);
    setShowHistory(false);
  }, [matchId, aiResponse]);

  if (!latestEntry || !latestEntry.response || !latestEntry.response.trim()) {
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
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-amber-800">Agent AI predpokladá:</span>
                <span className="text-[11px] font-medium text-amber-700">
                  {formatEventLabel(latestEntry.event)}
                  {latestEntry.timestamp ? ` · ${formatTimestamp(latestEntry.timestamp)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(prev => !prev)}
                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-900"
                  >
                    {showHistory ? 'Skryť históriu' : `Prezrieť celú históriu (${entries.length})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close AI prediction"
                  className="text-amber-700 hover:text-amber-900"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div className="px-3 pb-3">
              {renderMarkdown(latestEntry.response)}
            </div>
            {showHistory && entries.length > 1 && (
              <div className="px-3 pb-3">
                <div className="rounded-md border border-amber-200/70 bg-amber-100/40 p-3">
                  <div className="text-[11px] font-semibold text-amber-800 mb-2">Časová os</div>
                  <div className="space-y-4 border-l border-amber-200 pl-4">
                    {entries.map((entry, index) => (
                      <div key={`${entry.timestamp || 'no-time'}-${index}`} className="relative">
                        <span className="absolute -left-[11px] top-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-100" />
                        <div className="text-[11px] font-semibold text-amber-700">
                          {formatEventLabel(entry.event)}
                        </div>
                        {entry.timestamp && (
                          <div className="text-[10px] text-amber-600">{formatTimestamp(entry.timestamp)}</div>
                        )}
                        {entry.response && (
                          <div className="mt-1 text-xs">
                            {renderMarkdown(entry.response)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
