import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { SPHERE_COMMUNITY_GUIDELINES } from '../utils/discovery';

interface PolicyGuidelinesModalProps {
  open: boolean;
  onClose: () => void;
}

export const PolicyGuidelinesModal: React.FC<PolicyGuidelinesModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-guidelines-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-5 h-5 text-[#A5F3FC] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="policy-guidelines-title" className="font-display text-lg font-extrabold truncate">
                {SPHERE_COMMUNITY_GUIDELINES.title}
              </h2>
              <p className="text-xs text-white/80 truncate">
                {SPHERE_COMMUNITY_GUIDELINES.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sphere Policy Guidelines"
            className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm text-[var(--sp-ink-2)] leading-relaxed">
          <div className="space-y-2 pb-4 border-b border-[var(--sp-border-subtle)]">
            {SPHERE_COMMUNITY_GUIDELINES.preamble.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>

          <div className="space-y-5">
            {SPHERE_COMMUNITY_GUIDELINES.sections.map((section) => (
              <section
                key={section.number}
                className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2"
              >
                <h3 className="font-display text-base font-bold text-[var(--sp-ink)]">
                  {section.number}. {section.title}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--sp-ink-2)]">{section.intro}</p>
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-[var(--sp-ink)]">
                    {section.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {section.closing && (
                  <p className="text-xs font-medium text-[var(--sp-primary-text)] pt-1">
                    {section.closing}
                  </p>
                )}
              </section>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] text-xs text-[var(--sp-ink)] font-medium">
            {SPHERE_COMMUNITY_GUIDELINES.footerNote}
          </div>
        </div>

        <div className="px-6 py-3.5 bg-[var(--sp-surface-alt)] border-t border-[var(--sp-border)] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-semibold cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
