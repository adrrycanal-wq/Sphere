import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Smile, Sparkles, Sticker, X } from 'lucide-react';
import { AttachmentItem } from '../types/social';
import { GifSearchItem, apiSearchGifs } from '../utils/api';

interface ChatMediaPickerProps {
  initialTab?: 'emoji' | 'gif' | 'sticker';
  compact?: boolean;
  onSelectEmoji: (emoji: string) => void;
  onSelectAttachment: (attachment: AttachmentItem) => void;
  onClose: () => void;
}

interface EmojiEntry {
  char: string;
  name: string;
  cat: 'Smileys' | 'Gestures' | 'Hearts' | 'Party' | 'Tech';
}

const EMOJI_CATALOG: EmojiEntry[] = [
  { char: '😀', name: 'grin happy smile', cat: 'Smileys' },
  { char: '😂', name: 'laugh lol haha tears', cat: 'Smileys' },
  { char: '🥹', name: 'touched happy tear', cat: 'Smileys' },
  { char: '😍', name: 'love heart eyes', cat: 'Smileys' },
  { char: '🥰', name: 'warm love smile', cat: 'Smileys' },
  { char: '😎', name: 'cool shades sunglasses', cat: 'Smileys' },
  { char: '🤩', name: 'star struck amazed', cat: 'Smileys' },
  { char: '🥳', name: 'party birthday celebrate', cat: 'Smileys' },
  { char: '🤯', name: 'mind blown wow', cat: 'Smileys' },
  { char: '🤗', name: 'hug warm', cat: 'Smileys' },
  { char: '🤔', name: 'think hmm', cat: 'Smileys' },
  { char: '😴', name: 'sleepy tired', cat: 'Smileys' },
  { char: '😭', name: 'cry sob', cat: 'Smileys' },
  { char: '😜', name: 'wink tongue playful', cat: 'Smileys' },
  { char: '🫡', name: 'salute respect', cat: 'Smileys' },
  { char: '🤝', name: 'handshake deal', cat: 'Gestures' },
  { char: '👍', name: 'thumbs up ok yes apir', cat: 'Gestures' },
  { char: '👏', name: 'clap applause bravo', cat: 'Gestures' },
  { char: '🙌', name: 'raise hands hooray', cat: 'Gestures' },
  { char: '🙏', name: 'thanks please pray', cat: 'Gestures' },
  { char: '👋', name: 'wave hello hi bye', cat: 'Gestures' },
  { char: '✌️', name: 'peace victory', cat: 'Gestures' },
  { char: '💪', name: 'strong muscle gym', cat: 'Gestures' },
  { char: '🤙', name: 'call me shaka chill', cat: 'Gestures' },
  { char: '🫶', name: 'heart hands love', cat: 'Gestures' },
  { char: '❤️', name: 'red heart love', cat: 'Hearts' },
  { char: '💖', name: 'sparkling heart', cat: 'Hearts' },
  { char: '💜', name: 'purple heart sphere', cat: 'Hearts' },
  { char: '🩵', name: 'cyan heart sphere', cat: 'Hearts' },
  { char: '🔥', name: 'fire lit hot', cat: 'Hearts' },
  { char: '✨', name: 'sparkles magic shine', cat: 'Hearts' },
  { char: '💯', name: '100 percent perfect', cat: 'Hearts' },
  { char: '🎉', name: 'confetti party', cat: 'Party' },
  { char: '🎂', name: 'cake birthday', cat: 'Party' },
  { char: '🥂', name: 'cheers toast', cat: 'Party' },
  { char: '🏆', name: 'trophy winner gg', cat: 'Party' },
  { char: '🎵', name: 'music note', cat: 'Party' },
  { char: '☕', name: 'coffee kape', cat: 'Party' },
  { char: '🍰', name: 'cake bake pastry', cat: 'Party' },
  { char: '🌴', name: 'palm beach labo', cat: 'Party' },
  { char: '💻', name: 'laptop computer dev', cat: 'Tech' },
  { char: '🖥️', name: 'desktop pc monitor', cat: 'Tech' },
  { char: '📱', name: 'phone mobile', cat: 'Tech' },
  { char: '🎮', name: 'gaming controller', cat: 'Tech' },
  { char: '🚀', name: 'rocket launch ship', cat: 'Tech' },
  { char: '🏍️', name: 'motorcycle bike ride', cat: 'Tech' },
  { char: '📸', name: 'camera photo', cat: 'Tech' },
  { char: '🎨', name: 'art palette paint', cat: 'Tech' },
];

interface StickerSpec {
  id: string;
  label: string;
  pack: 'Pinoy & Labo' | 'Reactions' | 'Tech & Moto';
  emoji: string;
  bg1: string;
  bg2: string;
  badge: string;
  tags: string;
}

const STICKER_PACKS: StickerSpec[] = [
  { id: 'stk-kape', label: 'Tara Kape!', pack: 'Pinoy & Labo', emoji: '☕', bg1: '#F59E0B', bg2: '#B45309', badge: 'TARA KAPE!', tags: 'coffee kape break pinoy' },
  { id: 'stk-apir', label: 'Apir Solid!', pack: 'Pinoy & Labo', emoji: '🙌', bg1: '#4F46E5', bg2: '#06B6D4', badge: 'APIR SOLID!', tags: 'apir highfive solid pinoy' },
  { id: 'stk-ingat', label: 'Ingat Lagi!', pack: 'Pinoy & Labo', emoji: '🫶', bg1: '#EC4899', bg2: '#9333EA', badge: 'INGAT LAGI!', tags: 'care ingat love heart' },
  { id: 'stk-labo', label: 'Labo Pride!', pack: 'Pinoy & Labo', emoji: '🌴', bg1: '#059669', bg2: '#0D9488', badge: 'LABO VIBES', tags: 'labo camnorte philippines' },
  { id: 'stk-lol', label: 'Haha Laughtrip!', pack: 'Reactions', emoji: '🤣', bg1: '#F97316', bg2: '#EF4444', badge: 'LAUGHTRIP!', tags: 'laugh haha lol funny' },
  { id: 'stk-love', label: 'Big Hug & Love', pack: 'Reactions', emoji: '🥰', bg1: '#E11D48', bg2: '#DB2777', badge: 'LOVE YOU!', tags: 'love heart cute hug' },
  { id: 'stk-wow', label: 'Grabe Astig!', pack: 'Reactions', emoji: '🤩', bg1: '#7C3AED', bg2: '#2563EB', badge: 'ASTIG!', tags: 'wow amazing cool star' },
  { id: 'stk-congrats', label: 'Congrats Idol!', pack: 'Reactions', emoji: '🥳', bg1: '#0EA5E9', bg2: '#6366F1', badge: 'CONGRATS!', tags: 'congrats party celebrate' },
  { id: 'stk-ridesafe', label: 'Ride Safe!', pack: 'Tech & Moto', emoji: '🏍️', bg1: '#1E293B', bg2: '#DC2626', badge: 'RIDE SAFE!', tags: 'motorcycle ride bike moto' },
  { id: 'stk-ggwp', label: 'GGWP Clutch!', pack: 'Tech & Moto', emoji: '🏆', bg1: '#4338CA', bg2: '#0891B2', badge: 'GGWP!', tags: 'gaming win trophy gg' },
  { id: 'stk-shipit', label: 'Ship It Live!', pack: 'Tech & Moto', emoji: '🚀', bg1: '#0F172A', bg2: '#4F46E5', badge: 'SHIP IT!', tags: 'rocket deploy code dev' },
  { id: 'stk-buildpc', label: 'PC Master Rig!', pack: 'Tech & Moto', emoji: '🖥️', bg1: '#065F46', bg2: '#0284C7', badge: 'SOLID RIG!', tags: 'computer pc parts tech' },
];

function buildStickerDataUri(spec: StickerSpec): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${spec.bg1}" />
        <stop offset="100%" stop-color="${spec.bg2}" />
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="164" height="164" rx="44" fill="url(#g)" stroke="#ffffff" stroke-width="6" />
    <text x="90" y="98" text-anchor="middle" font-size="68">${spec.emoji}</text>
    <rect x="20" y="126" width="140" height="32" rx="16" fill="#0F172A" fill-opacity="0.82" />
    <text x="90" y="147" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" letter-spacing="0.8" fill="#FFFFFF">${spec.badge}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const ChatMediaPicker: React.FC<ChatMediaPickerProps> = ({
  initialTab = 'emoji',
  compact = false,
  onSelectEmoji,
  onSelectAttachment,
  onClose,
}) => {
  const [tab, setTab] = useState<'emoji' | 'gif' | 'sticker'>(initialTab);
  const [search, setSearch] = useState('');
  const [emojiCat, setEmojiCat] = useState<string>('All');

  // GIF search state
  const [gifCat, setGifCat] = useState<string>('All');
  const [gifs, setGifs] = useState<GifSearchItem[]>([]);
  const [gifCategories, setGifCategories] = useState<string[]>([
    'All',
    'Trending',
    'Reactions',
    'Celebration',
    'Tech & Gaming',
    'Pinoy Vibes',
  ]);
  const [loadingGifs, setLoadingGifs] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (tab !== 'gif') return;
    let cancelled = false;
    setLoadingGifs(true);
    const timer = window.setTimeout(() => {
      void apiSearchGifs(search, gifCat)
        .then((res) => {
          if (cancelled) return;
          setGifs(res.items);
          if (res.categories?.length) setGifCategories(res.categories);
        })
        .catch(() => {
          if (!cancelled) setGifs([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingGifs(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, search, gifCat]);

  const filteredEmojis = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EMOJI_CATALOG.filter((item) => {
      if (emojiCat !== 'All' && item.cat !== emojiCat) return false;
      if (!q) return true;
      return item.name.includes(q) || item.char === q;
    });
  }, [search, emojiCat]);

  const filteredStickers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STICKER_PACKS.filter(
      (s) => !q || s.label.toLowerCase().includes(q) || s.tags.includes(q) || s.pack.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div
      className={`bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
        compact ? 'w-[304px] h-[310px]' : 'w-[350px] h-[350px]'
      }`}
    >
      {/* Tabs Header */}
      <div className="px-2.5 pt-2 pb-1.5 bg-[var(--sp-surface-alt)] border-b border-[var(--sp-border-subtle)] flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('emoji')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
              tab === 'emoji'
                ? 'bg-[var(--sp-primary)] text-white'
                : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface)]'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emojis</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('gif')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
              tab === 'gif'
                ? 'bg-[#06B6D4] text-slate-950'
                : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>GIFs</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('sticker')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
              tab === 'sticker'
                ? 'bg-[var(--sp-primary)] text-white'
                : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface)]'
            }`}
          >
            <Sticker className="w-3.5 h-3.5" />
            <span>Stickers</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close picker"
          className="p-1 rounded-lg text-[var(--sp-muted)] hover:text-[var(--sp-ink)] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2.5 py-1.5 border-b border-[var(--sp-border-subtle)] flex items-center gap-1.5 bg-[var(--sp-surface)]">
        <Search className="w-3.5 h-3.5 text-[var(--sp-muted)] shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === 'emoji'
              ? 'Search emojis (happy, coffee, moto...)'
              : tab === 'gif'
                ? 'Search GIFs (party, kape, fire, gg...)'
                : 'Search stickers (apir, ride safe, lol...)'
          }
          className="w-full text-xs bg-transparent text-[var(--sp-ink)] placeholder:text-[var(--sp-muted)] focus:outline-none"
        />
      </div>

      {/* Content */}
      {tab === 'emoji' && (
        <>
          <div className="px-2 py-1 flex gap-1 overflow-x-auto border-b border-[var(--sp-border-subtle)] shrink-0">
            {['All', 'Smileys', 'Gestures', 'Hearts', 'Party', 'Tech'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setEmojiCat(cat)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 cursor-pointer ${
                  emojiCat === cat
                    ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)]'
                    : 'text-[var(--sp-muted)] hover:text-[var(--sp-ink)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-1 content-start">
            {filteredEmojis.map((em) => (
              <button
                key={`${em.cat}-${em.char}`}
                type="button"
                title={em.name}
                onClick={() => onSelectEmoji(em.char)}
                className="h-8 rounded-lg hover:bg-[var(--sp-surface-alt)] text-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-115"
              >
                {em.char}
              </button>
            ))}
            {filteredEmojis.length === 0 && (
              <div className="col-span-8 text-center text-xs text-[var(--sp-muted)] py-8">
                No matching emojis found.
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'gif' && (
        <>
          <div className="px-2 py-1 flex gap-1 overflow-x-auto border-b border-[var(--sp-border-subtle)] shrink-0">
            {gifCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setGifCat(cat)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 cursor-pointer ${
                  gifCat === cat
                    ? 'bg-[var(--sp-accent-soft)] text-[var(--sp-accent-text)]'
                    : 'text-[var(--sp-muted)] hover:text-[var(--sp-ink)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingGifs ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--sp-muted)] gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching GIFs...</span>
              </div>
            ) : gifs.length === 0 ? (
              <div className="text-center text-xs text-[var(--sp-muted)] py-8">
                No GIFs matched "{search}".
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    title={`Send GIF: ${g.title}`}
                    onClick={() => {
                      onSelectAttachment({
                        id: `gif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        name: `${g.title}.gif`,
                        url: g.url,
                        mimeType: 'image/svg+xml',
                        sizeBytes: 2048,
                        kind: 'gif',
                        label: g.title,
                      });
                      onClose();
                    }}
                    className="group relative rounded-xl overflow-hidden border border-[var(--sp-border)] hover:border-[#06B6D4] cursor-pointer bg-slate-900"
                  >
                    <img
                      src={g.previewUrl}
                      alt={g.title}
                      className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'sticker' && (
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-2 content-start">
          {filteredStickers.map((stk) => {
            const dataUri = buildStickerDataUri(stk);
            return (
              <button
                key={stk.id}
                type="button"
                title={`Send sticker: ${stk.label}`}
                onClick={() => {
                  onSelectAttachment({
                    id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: `${stk.label}.svg`,
                    url: dataUri,
                    mimeType: 'image/svg+xml',
                    sizeBytes: 1024,
                    kind: 'sticker',
                    label: stk.label,
                  });
                  onClose();
                }}
                className="p-1 rounded-xl hover:bg-[var(--sp-surface-alt)] border border-transparent hover:border-[var(--sp-primary)] cursor-pointer transition-transform hover:scale-105 flex flex-col items-center"
              >
                <img src={dataUri} alt={stk.label} className="w-20 h-20 object-contain" />
              </button>
            );
          })}
          {filteredStickers.length === 0 && (
            <div className="col-span-3 text-center text-xs text-[var(--sp-muted)] py-8">
              No matching stickers found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
