import React, { useState } from 'react';
import { ReactionTracker, ReactionType } from '../types/social';
import {
  MAX_REACTION_SWITCHES,
  REACTION_META,
  getReactionCounts,
  getTotalReactions,
  getUserActiveReaction,
} from '../utils/reactions';

interface ReactionControlsProps {
  currentUserId: string;
  reactions?: Partial<Record<ReactionType, string[]>>;
  tracker?: ReactionTracker;
  fallbackLikes?: string[];
  hideCounts?: boolean;
  compact?: boolean;
  onReact: (type: ReactionType) => Promise<void> | void;
}

export const ReactionControls: React.FC<ReactionControlsProps> = ({
  currentUserId,
  reactions,
  tracker,
  fallbackLikes,
  hideCounts = false,
  compact = false,
  onReact,
}) => {
  const [trayOpen, setTrayOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = getUserActiveReaction(currentUserId, reactions, tracker, fallbackLikes);
  const counts = getReactionCounts(reactions, fallbackLikes);
  const total = getTotalReactions(reactions, fallbackLikes);
  const switchesUsed = tracker?.switchCounts?.[currentUserId] || 0;
  const switchesLeft = Math.max(0, MAX_REACTION_SWITCHES - switchesUsed);

  const activeMeta = REACTION_META.find((m) => m.type === active);

  const handleSelect = async (type: ReactionType) => {
    if (busy) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      await onReact(type);
      setTrayOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to react right now.');
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <div className="inline-flex items-center gap-1">
          {REACTION_META.map((meta) => {
            const isSelected = active === meta.type;
            const count = counts[meta.type];
            return (
              <button
                key={meta.type}
                type="button"
                disabled={busy}
                onClick={() => handleSelect(meta.type)}
                title={`${meta.label}${switchesLeft < MAX_REACTION_SWITCHES ? ` (${switchesLeft} switches left)` : ''}`}
                className={`px-1.5 py-0.5 rounded-md text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] font-bold ring-1 ring-[var(--sp-primary-soft-border)]'
                    : 'text-[var(--sp-muted)] hover:bg-[var(--sp-surface-alt)] hover:text-[var(--sp-ink)]'
                }`}
              >
                <span>{meta.emoji}</span>
                {!hideCounts && count > 0 && <span className="tabular-nums">{count}</span>}
              </button>
            );
          })}
        </div>
        {errorMsg && <span className="text-[10px] text-red-500">{errorMsg}</span>}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div
          className="relative"
          onMouseEnter={() => setTrayOpen(true)}
          onMouseLeave={() => setTrayOpen(false)}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => setTrayOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
              activeMeta
                ? `bg-[var(--sp-primary-soft)] ${activeMeta.colorClass} border border-[var(--sp-primary-soft-border)]`
                : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)]'
            }`}
          >
            <span>{activeMeta ? activeMeta.emoji : '❤️'}</span>
            <span>{activeMeta ? activeMeta.label : 'React'}</span>
            {!hideCounts && total > 0 && (
              <span className="text-[11px] opacity-80 tabular-nums">({total})</span>
            )}
          </button>

          {trayOpen && (
            <div className="absolute left-0 bottom-full pb-1.5 z-30">
              <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl shadow-lg px-2 py-1.5 flex items-center gap-1">
                {REACTION_META.map((meta) => {
                  const isSelected = active === meta.type;
                  return (
                    <button
                      key={meta.type}
                      type="button"
                      disabled={busy}
                      onClick={() => handleSelect(meta.type)}
                      title={`${meta.label} · ${switchesLeft} switch${switchesLeft === 1 ? '' : 'es'} left`}
                      className={`px-2 py-1 rounded-lg text-sm flex items-center gap-1 cursor-pointer transition-transform hover:scale-110 ${
                        isSelected
                          ? 'bg-[var(--sp-primary-soft)] ring-1 ring-[var(--sp-primary)]'
                          : 'hover:bg-[var(--sp-surface-alt)]'
                      }`}
                    >
                      <span>{meta.emoji}</span>
                      <span className="text-[11px] font-semibold text-[var(--sp-ink)] hidden sm:inline">
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!hideCounts && total > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sp-muted)] tabular-nums">
            {REACTION_META.filter((m) => counts[m.type] > 0).map((m) => (
              <span key={m.type} className="inline-flex items-center gap-0.5">
                <span>{m.emoji}</span>
                <span>{counts[m.type]}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {switchesUsed > 0 && (
        <span className="text-[10px] text-[var(--sp-muted)]">
          Single reaction · {switchesLeft} of {MAX_REACTION_SWITCHES} reaction switches left
        </span>
      )}
      {errorMsg && <span className="text-[11px] text-red-500 font-medium">{errorMsg}</span>}
    </div>
  );
};
