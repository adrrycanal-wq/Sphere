import React, { useEffect, useRef, useState } from 'react';
import { Radio, Send, StopCircle, Users, Video, VideoOff, X } from 'lucide-react';
import { PrivacyLevel, SocialPost, UserProfile } from '../types/social';
import { apiEndLiveStream, apiSendLiveChat, apiStartLiveStream } from '../utils/api';
import { UserAvatar } from './Media';

interface LiveStreamModalProps {
  open: boolean;
  currentUser: UserProfile;
  users: UserProfile[];
  viewingPost?: SocialPost | null;
  onClose: () => void;
  onStreamStarted: (post: SocialPost) => void;
  onStreamUpdated: (post: SocialPost) => void;
}

export const LiveStreamModal: React.FC<LiveStreamModalProps> = ({
  open,
  currentUser,
  users,
  viewingPost,
  onClose,
  onStreamStarted,
  onStreamUpdated,
}) => {
  const [title, setTitle] = useState('Morning studio & community check-in from Labo');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('public');
  const [activePost, setActivePost] = useState<SocialPost | null>(viewingPost || null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [cameraOk, setCameraOk] = useState(false);
  const [chatText, setChatText] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setActivePost(viewingPost || null);
  }, [viewingPost]);

  useEffect(() => {
    if (!open || viewingPost) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = media;
        setCameraOk(true);
        if (videoRef.current) {
          videoRef.current.srcObject = media;
        }
      })
      .catch(() => {
        setCameraOk(false);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, viewingPost]);

  useEffect(() => {
    if (!activePost?.liveStream?.isLive) return;
    const timer = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activePost?.liveStream?.isLive]);

  if (!open) return null;

  const formatDuration = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleGoLive = async () => {
    setError(null);
    try {
      const res = await apiStartLiveStream({
        authorId: currentUser.id,
        title,
        privacy,
        location: currentUser.location,
      });
      setActivePost(res.post);
      setElapsedSec(0);
      onStreamStarted(res.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start On Live broadcast.');
    }
  };

  const handleEndLive = async () => {
    if (!activePost?.liveStream) return;
    try {
      const res = await apiEndLiveStream(
        activePost.liveStream.id,
        currentUser.id,
        formatDuration(elapsedSec)
      );
      setActivePost(res.post);
      onStreamUpdated(res.post);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end broadcast.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePost?.liveStream || !chatText.trim()) return;
    try {
      const res = await apiSendLiveChat(activePost.liveStream.id, currentUser.id, chatText.trim());
      setActivePost(res.post);
      onStreamUpdated(res.post);
      setChatText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat error.');
    }
  };

  const triggerEmoji = (emoji: string) => {
    const id = Date.now() + Math.random();
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    window.setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((x) => x.id !== id));
    }, 1400);
  };

  const isBroadcaster = !viewingPost || activePost?.authorId === currentUser.id;
  const broadcaster = users.find((u) => u.id === (activePost?.authorId || currentUser.id));

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12"
      >
        {/* Video / Broadcast Stage */}
        <div className="lg:col-span-7 bg-slate-950 text-white flex flex-col justify-between p-4 relative min-h-[340px]">
          <div className="flex items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1.5 ${
                  activePost?.liveStream?.isLive ? 'bg-rose-600' : 'bg-slate-800'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>
                  {activePost?.liveStream?.isLive
                    ? `ON LIVE · ${formatDuration(elapsedSec)}`
                    : activePost
                      ? `REPLAY · ${activePost.liveStream?.durationLabel}`
                      : 'ON LIVE STUDIO'}
                </span>
              </span>
              {activePost?.liveStream && (
                <span className="px-2 py-1 rounded-md bg-slate-900/80 text-xs font-mono-code inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#22D3EE]" />
                  {activePost.liveStream.viewerCount}
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="my-3 flex-1 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative flex items-center justify-center">
            {cameraOk && !viewingPost ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="p-6 text-center space-y-2">
                {cameraOk ? <Video className="w-10 h-10 mx-auto text-[#22D3EE]" /> : <VideoOff className="w-10 h-10 mx-auto text-[#22D3EE]" />}
                <div className="font-display text-base font-bold">
                  {activePost?.liveStream?.title || title}
                </div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {broadcaster?.name} · {broadcaster?.location}
                </p>
              </div>
            )}

            {/* Floating Reactions */}
            <div className="absolute right-4 bottom-4 flex flex-col gap-1 pointer-events-none">
              {floatingEmojis.map((item) => (
                <span key={item.id} className="text-2xl animate-bounce">
                  {item.emoji}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {['❤️', '👏', '🔥', '😂'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => triggerEmoji(em)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sm cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>

            {!activePost && isBroadcaster && (
              <button
                type="button"
                onClick={handleGoLive}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Start On Live Broadcast</span>
              </button>
            )}

            {activePost?.liveStream?.isLive && isBroadcaster && (
              <button
                type="button"
                onClick={handleEndLive}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>End Stream &amp; Post Replay</span>
              </button>
            )}
          </div>
        </div>

        {/* Setup & Live Chat */}
        <div className="lg:col-span-5 flex flex-col max-h-[500px] lg:max-h-full">
          <div className="p-4 border-b border-[var(--sp-border)] space-y-2.5">
            <div className="flex items-center gap-2.5">
              <UserAvatar user={broadcaster} size="sm" isOnline />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--sp-ink)] truncate">
                  {broadcaster?.name}
                </div>
                <div className="text-[11px] text-[var(--sp-muted)]">On Live Interactive Chat</div>
              </div>
            </div>

            {!activePost && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Broadcast title..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                >
                  <option value="public">Everyone</option>
                  <option value="friends_of_friends">Friends of Friends</option>
                  <option value="friends_only">Friends Only</option>
                </select>
              </div>
            )}
            {error && <div className="text-xs text-red-500">{error}</div>}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[var(--sp-bg)]">
            {!activePost?.liveStream?.chatMessages.length ? (
              <p className="text-xs text-[var(--sp-muted)] text-center py-8">
                {activePost
                  ? 'Be the first to send a live comment.'
                  : 'Start your broadcast to open real-time viewer chat.'}
              </p>
            ) : (
              activePost.liveStream.chatMessages.map((c) => {
                const u = users.find((x) => x.id === c.authorId);
                return (
                  <div key={c.id} className="flex items-start gap-2 text-xs">
                    <UserAvatar user={u} size="xs" />
                    <div>
                      <span className="font-bold text-[var(--sp-ink)] mr-1.5">{u?.name}</span>
                      <span className="text-[var(--sp-ink-2)]">{c.text}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {activePost && (
            <form
              onSubmit={handleSendChat}
              className="p-3 border-t border-[var(--sp-border)] flex items-center gap-2"
            >
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Say something in live chat..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-[var(--sp-primary)] text-white cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
