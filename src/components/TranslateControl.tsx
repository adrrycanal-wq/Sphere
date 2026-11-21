import React, { useEffect, useRef, useState } from 'react';
import { Languages, RotateCcw } from 'lucide-react';
import { TranslationResult, translateText } from '../utils/translate';

interface TranslateControlProps {
  text: string;
  preferredLanguage?: string;
  sourceLanguageHint?: string;
  autoTranslate?: boolean;
  variant?: 'default' | 'inverted' | 'compact';
  className?: string;
}

export const TranslateControl: React.FC<TranslateControlProps> = ({
  text,
  preferredLanguage = 'English',
  sourceLanguageHint,
  autoTranslate = false,
  variant = 'default',
  className = '',
}) => {
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTriggeredKeyRef = useRef<string>('');

  const trimmed = text.trim();
  const targetLang = preferredLanguage || 'English';

  const hintDiffersFromTarget = Boolean(
    sourceLanguageHint &&
      !sourceLanguageHint.toLowerCase().includes(targetLang.toLowerCase()) &&
      !(
        targetLang.toLowerCase() === 'english' &&
        sourceLanguageHint.toLowerCase().includes('english')
      )
  );
  const hasNonAscii = /[^\u0000-\u007F]/.test(trimmed);

  const runTranslate = async () => {
    if (!trimmed || loading) return;
    if (translation && !error) {
      setShowTranslated(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await translateText(trimmed, targetLang);
      setTranslation(res);
      setShowTranslated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTranslation(null);
    setShowTranslated(false);
    setError(null);
  }, [trimmed, targetLang]);

  useEffect(() => {
    const key = `${trimmed}::${targetLang}`;
    if (
      autoTranslate &&
      trimmed.length >= 6 &&
      (hintDiffersFromTarget || hasNonAscii) &&
      autoTriggeredKeyRef.current !== key
    ) {
      autoTriggeredKeyRef.current = key;
      void runTranslate();
    }
  }, [autoTranslate, trimmed, targetLang, hintDiffersFromTarget, hasNonAscii]);

  if (!trimmed) return null;

  const isInverted = variant === 'inverted';
  const triggerClass = isInverted
    ? 'text-[11px] font-semibold text-white/85 hover:text-white inline-flex items-center gap-1 cursor-pointer'
    : 'text-[11px] font-semibold text-[var(--sp-accent-text)] hover:underline inline-flex items-center gap-1 cursor-pointer';

  return (
    <div className={className}>
      {!showTranslated ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runTranslate}
            disabled={loading}
            className={triggerClass}
          >
            <Languages className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{loading ? 'Translating...' : `Translate to ${targetLang}`}</span>
          </button>
          {error && (
            <span className={`text-[11px] ${isInverted ? 'text-[#FCA5A5]' : 'text-red-500'}`}>
              {error}
            </span>
          )}
        </div>
      ) : translation ? (
        <div
          className={`mt-1.5 rounded-lg px-3 py-2 text-xs border ${
            isInverted
              ? 'bg-[#3730A3] border-[#6366F1] text-white'
              : 'bg-[var(--sp-accent-soft)] border-[var(--sp-accent-soft-border)] text-[var(--sp-ink)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span
              className={`text-[10px] font-mono-code font-semibold uppercase tracking-wide ${
                isInverted ? 'text-[#A5F3FC]' : 'text-[var(--sp-accent-text)]'
              }`}
            >
              {translation.sameLanguage
                ? `Already in ${targetLang}`
                : `Translated from ${translation.detectedLanguage} → ${targetLang}`}
            </span>
            <button
              type="button"
              onClick={() => setShowTranslated(false)}
              className={`text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:underline ${
                isInverted ? 'text-white/90' : 'text-[var(--sp-primary-text)]'
              }`}
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>See Original</span>
            </button>
          </div>
          <p className="leading-relaxed whitespace-pre-line">{translation.translatedText}</p>
        </div>
      ) : null}
    </div>
  );
};
