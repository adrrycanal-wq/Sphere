import React, { useState } from 'react';
import { BadgeCheck, Building2, ShieldAlert } from 'lucide-react';
import { SphereIdCategory } from '../types/social';
import { getSphereIdLabel } from '../utils/discovery';

interface SphereIdBadgeProps {
  category: SphereIdCategory;
  size?: 'sm' | 'md';
  showUnverified?: boolean;
  showLabel?: boolean;
  onOpenSphereId?: () => void;
}

export const SphereIdBadge: React.FC<SphereIdBadgeProps> = ({
  category,
  size = 'sm',
  showUnverified = false,
  showLabel = false,
  onOpenSphereId,
}) => {
  const [openInfo, setOpenInfo] = useState(false);

  if (category === 'unverified' && !showUnverified) {
    return null;
  }

  const label = getSphereIdLabel(category);
  const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const colorClass =
    category === 'verified_organization'
      ? 'text-[var(--sp-accent-text)]'
      : category === 'verified_individual'
        ? 'text-[var(--sp-primary-text)]'
        : 'text-[var(--sp-muted)]';

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpenInfo((prev) => !prev);
        }}
        title={`${label} — Click for Sphere ID details`}
        aria-label={label}
        className={`inline-flex items-center gap-1 ${colorClass} hover:opacity-80 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-[var(--sp-primary)]`}
      >
        {category === 'verified_organization' ? (
          <Building2 className={`${iconClass} shrink-0`} aria-hidden="true" />
        ) : category === 'verified_individual' ? (
          <BadgeCheck className={`${iconClass} shrink-0`} aria-hidden="true" />
        ) : (
          <ShieldAlert className={`${iconClass} shrink-0`} aria-hidden="true" />
        )}
        {showLabel && (
          <span className="text-[11px] font-semibold whitespace-nowrap">{label}</span>
        )}
      </button>

      {openInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1.5 z-40 w-64 p-3 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] shadow-lg text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-bold ${colorClass}`}>{label}</span>
            <button
              type="button"
              onClick={() => setOpenInfo(false)}
              className="text-[11px] font-semibold text-[var(--sp-muted)] hover:text-[var(--sp-ink)] cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--sp-ink-2)]">
            {category === 'verified_organization'
              ? 'This account completed Sphere ID government-registered organization review.'
              : category === 'verified_individual'
                ? 'This account completed Sphere ID individual verification.'
                : 'This account has not completed Sphere ID verification.'}
          </p>
          {onOpenSphereId && (
            <button
              type="button"
              onClick={() => {
                setOpenInfo(false);
                onOpenSphereId();
              }}
              className="mt-2 text-[11px] font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
            >
              Manage Sphere ID →
            </button>
          )}
        </div>
      )}
    </span>
  );
};
