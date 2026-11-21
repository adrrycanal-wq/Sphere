import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { AttachmentItem } from '../types/social';

interface VoiceAudioBubbleProps {
  attachment: AttachmentItem;
  isMine?: boolean;
  compact?: boolean;
}

const VOICE_PLAY_EVENT = 'sphere:voice-play';

export function formatAudioClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VoiceAudioBubble: React.FC<VoiceAudioBubbleProps> = ({
  attachment,
  isMine = false,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(
    attachment.durationSeconds && attachment.durationSeconds > 0
      ? attachment.durationSeconds
      : 0
  );
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const barCount = compact ? 18 : 24;
  const bars = useMemo(() => {
    const seed = attachment.id || attachment.name || 'voice';
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return Array.from({ length: barCount }, (_, idx) => {
      const n = ((hash + idx * 73) % 100) / 100;
      return Math.round(28 + n * 68);
    });
  }, [attachment.id, attachment.name, barCount]);

  useEffect(() => {
    const audio = new Audio(attachment.url);
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setPlaying(false);
      setPlaybackError('Audio unavailable');
    };

    const handleOtherPlay = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== attachment.id && !audio.paused) {
        audio.pause();
        setPlaying(false);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    window.addEventListener(VOICE_PLAY_EVENT, handleOtherPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      window.removeEventListener(VOICE_PLAY_EVENT, handleOtherPlay);
      audioRef.current = null;
    };
  }, [attachment.id, attachment.url]);

  const effectiveDuration =
    duration > 0
      ? duration
      : attachment.durationSeconds && attachment.durationSeconds > 0
        ? attachment.durationSeconds
        : 0;

  const progress =
    effectiveDuration > 0 ? Math.min(1, Math.max(0, currentTime / effectiveDuration)) : 0;

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError(null);

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    window.dispatchEvent(
      new CustomEvent(VOICE_PLAY_EVENT, { detail: { id: attachment.id } })
    );
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setPlaybackError('Unable to play');
    }
  };

  const handleSeek = (ratio: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || effectiveDuration <= 0) {
      void togglePlay(e);
      return;
    }
    const target = Math.max(0, Math.min(effectiveDuration, ratio * effectiveDuration));
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = target;
      setCurrentTime(target);
    }
    if (!playing) {
      void togglePlay(e);
    }
  };

  return (
    <div
      role="group"
      aria-label={`Voice clip ${formatAudioClock(effectiveDuration)}`}
      onClick={(e) => {
        void togglePlay(e);
      }}
      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer select-none transition-colors ${
        compact ? 'min-w-[190px]' : 'min-w-[225px]'
      } ${
        isMine
          ? 'bg-white/15 hover:bg-white/20 text-white'
          : 'bg-[var(--sp-surface-alt)] hover:bg-[var(--sp-primary-soft)] text-[var(--sp-ink)] border border-[var(--sp-border-subtle)]'
      }`}
    >
      <button
        type="button"
        onClick={(e) => void togglePlay(e)}
        aria-label={playing ? 'Pause voice clip' : 'Play voice clip'}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95 ${
          isMine
            ? 'bg-[#06B6D4] text-slate-950 shadow-xs'
            : 'bg-[var(--sp-primary)] text-white shadow-xs'
        }`}
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-[2px] h-6 cursor-pointer"
          title="Click waveform to play or seek"
        >
          {bars.map((heightPct, idx) => {
            const barRatio = (idx + 1) / bars.length;
            const active = playing ? barRatio <= progress : barRatio <= progress && currentTime > 0;
            return (
              <button
                key={idx}
                type="button"
                aria-label={`Seek to ${Math.round(barRatio * 100)}%`}
                onClick={(e) => handleSeek(barRatio, e)}
                style={{ height: `${heightPct}%` }}
                className={`flex-1 min-w-[2px] rounded-full transition-all cursor-pointer ${
                  active
                    ? isMine
                      ? 'bg-[#A5F3FC]'
                      : 'bg-[var(--sp-primary)]'
                    : isMine
                      ? 'bg-white/40 hover:bg-white/65'
                      : 'bg-[var(--sp-muted)]/35 hover:bg-[var(--sp-primary)]/60'
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 mt-1 text-[10px] font-mono-code">
          <span className="inline-flex items-center gap-1 opacity-85">
            <Mic className="w-2.5 h-2.5" />
            <span>{playbackError || (playing ? 'Playing' : 'Voice clip')}</span>
          </span>
          <span className="tabular-nums font-semibold">
            {playing || currentTime > 0
              ? `${formatAudioClock(currentTime)} / ${formatAudioClock(effectiveDuration)}`
              : formatAudioClock(effectiveDuration)}
          </span>
        </div>
      </div>
    </div>
  );
};
