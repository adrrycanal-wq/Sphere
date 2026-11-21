import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  Maximize2,
  MessageCircle,
  Mic,
  Minus,
  MonitorUp,
  Paperclip,
  Plus,
  Send,
  Smile,
  Sparkles,
  Square,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  AttachmentItem,
  MessageThread,
  NavRoute,
  UserProfile,
} from '../types/social';
import { apiUploadFile } from '../utils/api';
import { ChatMediaPicker } from './ChatMediaPicker';
import { useImageViewer } from './ImageViewerContext';
import { UserAvatar } from './Media';
import { TranslateControl } from './TranslateControl';
import { VoiceAudioBubble, formatAudioClock } from './VoiceAudioBubble';

interface FloatingMessengerProps {
  currentUser: UserProfile;
  users: UserProfile[];
  threads: MessageThread[];
  onlineUserIds: string[];
  typingByThread: Record<string, string[]>; // threadId -> userIds currently typing
  openThreadIds: string[];
  minimizedThreadIds: string[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenThread: (threadId: string) => void;
  onMinimizeThread: (threadId: string) => void;
  onCloseThread: (threadId: string) => void;
  onSendMessage: (
    threadId: string,
    text: string,
    attachments?: AttachmentItem[]
  ) => Promise<void>;
  onMarkRead: (threadId: string) => void;
  onReactMessage: (threadId: string, messageId: string, emoji: string) => void;
  onTypingChange: (threadId: string, isTyping: boolean) => void;
  onNavigate: (route: NavRoute) => void;
  onStartCall: (threadId: string, mode: 'video' | 'screen') => void;
  onOpenCreateGroup: () => void;
  onOpenGroupSettings: (threadId: string) => void;
  onReplaceGroupLogo: (threadId: string, file: File) => Promise<void>;
}

const CHAT_EMOJIS = ['❤️', '👏', '😂', '🔥', '👍'];
const MAX_VOICE_CLIP_SECONDS = 60;

const ThreadHeadAvatar: React.FC<{
  thread: MessageThread;
  peer?: UserProfile;
  isOnline?: boolean;
  size: 'sm' | 'lg';
}> = ({ thread, peer, isOnline = false, size }) => {
  if (thread.isGroup) {
    const dim = size === 'lg' ? 'w-11 h-11' : 'w-8 h-8';
    return (
      <div
        className={`${dim} rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white font-bold shadow-xs`}
        style={{ backgroundColor: thread.avatar ? undefined : thread.avatarColor || '#4F46E5' }}
      >
        {thread.avatar ? (
          <img
            src={thread.avatar}
            alt={thread.title || 'Group logo'}
            className="w-full h-full object-cover"
          />
        ) : (
          <Users className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
        )}
      </div>
    );
  }
  return <UserAvatar user={peer} size={size} isOnline={isOnline} />;
};

function pickVoiceMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionForVoiceMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base === 'audio/ogg') return '.ogg';
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return '.m4a';
  if (base === 'audio/wav') return '.wav';
  if (base === 'audio/mpeg') return '.mp3';
  return '.webm';
}

export function playMessengerChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.11);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.23);
  } catch {
    // Ignore audio context restrictions
  }
}

interface ChatWindowProps {
  thread: MessageThread;
  currentUser: UserProfile;
  users: UserProfile[];
  onlineUserIds: string[];
  typingUserIds: string[];
  isMobileSheet?: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onSend: (text: string, attachments?: AttachmentItem[]) => Promise<void>;
  onMarkRead: () => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onTypingChange: (isTyping: boolean) => void;
  onNavigate: (route: NavRoute) => void;
  onStartCall: (mode: 'video' | 'screen') => void;
  onOpenGroupSettings: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  thread,
  currentUser,
  users,
  onlineUserIds,
  typingUserIds,
  isMobileSheet = false,
  onMinimize,
  onClose,
  onSend,
  onMarkRead,
  onReactMessage,
  onTypingChange,
  onNavigate,
  onStartCall,
  onOpenGroupSettings,
}) => {
  const { openImage } = useImageViewer();
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [emojiMenuMsgId, setEmojiMenuMsgId] = useState<string | null>(null);
  const [mediaPickerTab, setMediaPickerTab] = useState<'emoji' | 'gif' | 'sticker' | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevels, setMicLevels] = useState<number[]>(Array(10).fill(20));
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartMsRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const recordFinishModeRef = useRef<'cancel' | 'attach' | 'send'>('attach');

  const others = thread.participantIds
    .filter((id) => id !== currentUser.id)
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is UserProfile => Boolean(u));

  const primaryPeer = others[0];
  const title = thread.title || others.map((u) => u.name).join(', ') || 'Conversation';
  const isOnline = others.some((u) => onlineUserIds.includes(u.id));

  const cleanupRecorderResources = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (meterRafRef.current) {
      window.cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
    setMicLevels(Array(10).fill(20));
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        recordFinishModeRef.current = 'cancel';
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupRecorderResources();
    };
  }, [thread.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (thread.unreadCount > 0) {
      onMarkRead();
    }
  }, [thread.messages.length, thread.id]);

  const handleInput = (val: string) => {
    setDraft(val);
    onTypingChange(val.trim().length > 0);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      onTypingChange(false);
    }, 1800);
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVoiceError(null);
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const uploaded = await apiUploadFile({
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });
      const kind: AttachmentItem['kind'] = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'file';
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: `att-${Date.now()}`,
          name: uploaded.name,
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          kind,
        },
      ]);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Unable to upload attachment.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const uploadRecordedBlob = async (blob: Blob, durationSec: number): Promise<AttachmentItem> => {
    const mime = blob.type || 'audio/webm';
    const ext = extensionForVoiceMime(mime);
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read recorded audio'));
      reader.readAsDataURL(blob);
    });
    const uploaded = await apiUploadFile({
      fileName: `voice-clip-${Date.now()}${ext}`,
      mimeType: mime,
      dataBase64,
    });
    return {
      id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: uploaded.name,
      url: uploaded.url,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      kind: 'audio',
      durationSeconds: Math.max(1, Math.round(durationSec)),
    };
  };

  const startVoiceRecording = async () => {
    if (isRecording || uploading || sending) return;
    setVoiceError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setVoiceError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const preferredMime = pickVoiceMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordFinishModeRef.current = 'attach';
      recordStartMsRef.current = Date.now();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Live mic level meter using Web Audio AnalyserNode
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          const freqData = new Uint8Array(analyser.frequencyBinCount);
          const pumpMeter = () => {
            if (!audioCtxRef.current) return;
            analyser.getByteFrequencyData(freqData);
            const bars = Array.from({ length: 10 }, (_, idx) => {
              const v = freqData[idx % freqData.length] || 0;
              return Math.min(100, Math.max(18, Math.round((v / 255) * 100)));
            });
            setMicLevels(bars);
            meterRafRef.current = window.requestAnimationFrame(pumpMeter);
          };
          meterRafRef.current = window.requestAnimationFrame(pumpMeter);
        }
      } catch {
        // Fallback if Web Audio analyser is restricted
      }

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const mode = recordFinishModeRef.current;
        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - recordStartMsRef.current) / 1000)
        );
        const rawChunks = chunksRef.current.slice();
        const actualMime = recorder.mimeType || preferredMime || 'audio/webm';
        cleanupRecorderResources();

        if (mode === 'cancel' || rawChunks.length === 0) return;

        const blob = new Blob(rawChunks, { type: actualMime });
        if (blob.size < 64) {
          setVoiceError('Recording was too short. Hold and speak for at least 1 second.');
          return;
        }

        void (async () => {
          setUploading(true);
          try {
            const voiceAttachment = await uploadRecordedBlob(blob, elapsedSec);
            if (mode === 'send') {
              setSending(true);
              try {
                await onSend(draft.trim(), [...pendingAttachments, voiceAttachment]);
                setDraft('');
                setPendingAttachments([]);
              } finally {
                setSending(false);
              }
            } else {
              setPendingAttachments((prev) => [...prev, voiceAttachment]);
            }
          } catch (err) {
            setVoiceError(
              err instanceof Error ? err.message : 'Failed to upload voice clip.'
            );
          } finally {
            setUploading(false);
          }
        })();
      };

      recorder.start(200);
      recordTimerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - recordStartMsRef.current) / 1000);
        setRecordingSeconds(sec);
        if (sec >= MAX_VOICE_CLIP_SECONDS && recorder.state === 'recording') {
          recordFinishModeRef.current = 'attach';
          recorder.stop();
        }
      }, 250);
    } catch (err) {
      cleanupRecorderResources();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setVoiceError(
          'Microphone permission denied. Please allow microphone access in your browser to send voice clips.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setVoiceError('No microphone detected on this device.');
      } else {
        setVoiceError('Could not access microphone. Please check browser audio settings.');
      }
    }
  };

  const finishVoiceRecording = (mode: 'cancel' | 'attach' | 'send') => {
    const recorder = mediaRecorderRef.current;
    recordFinishModeRef.current = mode;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanupRecorderResources();
    }
  };

  const submitMessage = async () => {
    const clean = draft.trim();
    if ((!clean && pendingAttachments.length === 0) || sending) return;
    setSending(true);
    onTypingChange(false);
    try {
      await onSend(clean, pendingAttachments.length > 0 ? pendingAttachments : undefined);
      setDraft('');
      setPendingAttachments([]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={
        isMobileSheet
          ? 'fixed inset-0 z-50 bg-[var(--sp-surface)] flex flex-col'
          : 'w-[328px] h-[440px] rounded-t-2xl bg-[var(--sp-surface)] border border-b-0 border-[var(--sp-border)] shadow-2xl flex flex-col overflow-hidden'
      }
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--sp-primary)] text-white flex items-center justify-between gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (thread.isGroup) {
              onOpenGroupSettings();
            } else if (primaryPeer) {
              onNavigate({ page: 'profile', userId: primaryPeer.id, tab: 'timeline' });
            }
          }}
          title={thread.isGroup ? 'Replace group logo or manage members' : `View ${title}`}
          className="flex items-center gap-2 min-w-0 text-left cursor-pointer hover:opacity-90"
        >
          <ThreadHeadAvatar thread={thread} peer={primaryPeer} isOnline={isOnline} size="sm" />
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">{title}</div>
            <div className="text-[10px] text-[#A5F3FC] truncate">
              {typingUserIds.length > 0
                ? 'Typing...'
                : thread.isGroup
                  ? `${thread.participantIds.length.toLocaleString()} members · Tap to edit logo`
                  : isOnline
                    ? 'Active now'
                    : 'Offline · Messages saved'}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onStartCall('video')}
            title="Start Video Call with Filters"
            className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
          >
            <Video className="w-3.5 h-3.5 text-[#A5F3FC]" />
          </button>
          <button
            type="button"
            onClick={() => onStartCall('screen')}
            title="Share Screen"
            className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
          >
            <MonitorUp className="w-3.5 h-3.5" />
          </button>
          {!isMobileSheet && (
            <button
              type="button"
              onClick={onMinimize}
              title="Minimize chat"
              className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate({ page: 'messages', threadId: thread.id })}
            title="Open in full Messages"
            className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close chat"
            className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div
        ref={scrollRef}
        onClick={onMarkRead}
        className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--sp-bg)]"
      >
        {thread.messages.length === 0 ? (
          <div className="text-center text-xs text-[var(--sp-muted)] py-10">
            Start a real-time conversation with {title}.
          </div>
        ) : (
          thread.messages.map((m) => {
            const isMine = m.senderId === currentUser.id;
            const sender = users.find((u) => u.id === m.senderId);
            const reactionList = Object.entries(m.reactions || {});
            const isRead = (m.readBy || []).some((id) => id !== currentUser.id);
            const isDelivered = (m.deliveredTo || []).some((id) => id !== currentUser.id);

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex items-end gap-1.5 max-w-[85%] ${isMine ? 'flex-row-reverse' : ''}`}>
                  {!isMine && <UserAvatar user={sender} size="xs" />}
                  <div className="relative group">
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? 'bg-[var(--sp-primary)] text-white rounded-br-sm'
                          : 'bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-ink)] rounded-bl-sm'
                      }`}
                    >
                      {m.text && <p className="whitespace-pre-line">{m.text}</p>}

                      {m.attachments && m.attachments.length > 0 && (
                        <div className={`${m.text ? 'mt-1.5' : ''} space-y-1.5`}>
                          {m.attachments.map((att) => {
                            const visualGallery = thread.messages
                              .flatMap((msgItem) => msgItem.attachments || [])
                              .filter((item) => item.kind === 'image' || item.kind === 'gif' || item.kind === 'sticker')
                              .map((item) => ({
                                src: item.url,
                                alt: item.label || item.name,
                                title: item.label || item.name,
                                subtitle: `Messenger · ${title}`,
                              }));

                            if (att.kind === 'image') {
                              return (
                                <img
                                  key={att.id}
                                  src={att.url}
                                  alt={att.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImage({
                                      src: att.url,
                                      alt: att.name,
                                      title: att.name,
                                      subtitle: `${sender?.name || 'Member'} · ${title}`,
                                      badge: 'Messenger Photo',
                                      gallery: visualGallery,
                                    });
                                  }}
                                  className="max-h-40 rounded-lg object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
                                />
                              );
                            }
                            if (att.kind === 'gif') {
                              return (
                                <img
                                  key={att.id}
                                  src={att.url}
                                  alt={att.label || att.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImage({
                                      src: att.url,
                                      alt: att.label || att.name,
                                      title: att.label || att.name,
                                      subtitle: `GIF · ${sender?.name || 'Member'} · ${title}`,
                                      badge: 'Messenger GIF',
                                      gallery: visualGallery,
                                    });
                                  }}
                                  className="max-h-36 rounded-xl object-cover shadow-xs cursor-zoom-in hover:opacity-95 transition-opacity"
                                />
                              );
                            }
                            if (att.kind === 'sticker') {
                              return (
                                <img
                                  key={att.id}
                                  src={att.url}
                                  alt={att.label || att.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImage({
                                      src: att.url,
                                      alt: att.label || att.name,
                                      title: att.label || att.name,
                                      subtitle: `Sticker · ${sender?.name || 'Member'}`,
                                      badge: 'Messenger Sticker',
                                      gallery: visualGallery,
                                    });
                                  }}
                                  className="w-24 h-24 object-contain drop-shadow-xs cursor-zoom-in hover:scale-105 transition-transform"
                                />
                              );
                            }
                            return att.kind === 'video' ? (
                              <video
                                key={att.id}
                                src={att.url}
                                controls
                                className="max-h-40 rounded-lg"
                              />
                            ) : att.kind === 'audio' ? (
                              <VoiceAudioBubble
                                key={att.id}
                                attachment={att}
                                isMine={isMine}
                                compact
                              />
                            ) : (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block underline text-[11px]"
                              >
                                📎 {att.name}
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {!isMine && m.text && (
                        <TranslateControl
                          text={m.text}
                          preferredLanguage={currentUser.preferredLanguage || 'English'}
                          sourceLanguageHint={m.language}
                          autoTranslate={currentUser.autoTranslate}
                          className="mt-1"
                        />
                      )}
                    </div>

                    {/* Emoji Reaction Trigger */}
                    <button
                      type="button"
                      onClick={() =>
                        setEmojiMenuMsgId((prev) => (prev === m.id ? null : m.id))
                      }
                      title="React to message"
                      className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-muted)] cursor-pointer transition-opacity ${
                        isMine ? '-left-7' : '-right-7'
                      }`}
                    >
                      <Smile className="w-3 h-3" />
                    </button>

                    {emojiMenuMsgId === m.id && (
                      <div
                        className={`absolute bottom-full mb-1 z-20 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-full px-1.5 py-0.5 shadow-md flex items-center gap-0.5 ${
                          isMine ? 'right-0' : 'left-0'
                        }`}
                      >
                        {CHAT_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => {
                              onReactMessage(m.id, em);
                              setEmojiMenuMsgId(null);
                            }}
                            className="p-1 hover:scale-125 transition-transform cursor-pointer text-xs"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}

                    {reactionList.length > 0 && (
                      <div className="flex gap-1 mt-0.5 justify-end">
                        {reactionList.map(([uid, em]) => (
                          <span
                            key={uid}
                            className="px-1.5 py-0.2 rounded-full bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[10px] shadow-xs"
                          >
                            {em}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-[var(--sp-muted)] mt-0.5 flex items-center gap-1 px-1">
                  <span>{m.timestamp}</span>
                  {isMine &&
                    (isRead ? (
                      <span className="inline-flex items-center gap-0.5 text-[var(--sp-accent-text)] font-medium">
                        <CheckCheck className="w-3 h-3" /> Seen
                      </span>
                    ) : isDelivered ? (
                      <span className="inline-flex items-center gap-0.5">
                        <CheckCheck className="w-3 h-3" /> Delivered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Sent
                      </span>
                    ))}
                </div>
              </div>
            );
          })
        )}

        {typingUserIds.length > 0 && (
          <div className="text-[11px] italic text-[var(--sp-accent-text)] px-2">
            {users.find((u) => u.id === typingUserIds[0])?.name.split(' ')[0] || 'Friend'} is typing...
          </div>
        )}
      </div>

      {/* Voice Error Notice */}
      {voiceError && (
        <div className="px-3 py-1.5 bg-red-500/10 border-t border-red-500/30 flex items-center justify-between gap-2 text-[11px] text-red-600 dark:text-red-300">
          <span className="leading-snug">{voiceError}</span>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            className="text-red-500 hover:text-red-700 font-bold cursor-pointer shrink-0"
            aria-label="Dismiss audio notice"
          >
            ×
          </button>
        </div>
      )}

      {/* Pending Attachments */}
      {pendingAttachments.length > 0 && (
        <div className="px-3 py-2 bg-[var(--sp-surface-alt)] border-t border-[var(--sp-border-subtle)] space-y-1.5">
          {pendingAttachments.map((a) =>
            a.kind === 'audio' ? (
              <div key={a.id} className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <VoiceAudioBubble attachment={a} isMine={false} compact />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  title="Remove voice clip"
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[10px] text-[var(--sp-ink)] mr-1.5"
              >
                <span className="truncate max-w-[120px]">{a.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  className="text-red-500 cursor-pointer"
                >
                  ×
                </button>
              </span>
            )
          )}
        </div>
      )}

      {/* Expression Picker (Emojis, GIF Search, Stickers) */}
      {mediaPickerTab && (
        <div className="relative px-2 pt-2 bg-[var(--sp-bg)] border-t border-[var(--sp-border-subtle)] flex justify-center">
          <ChatMediaPicker
            initialTab={mediaPickerTab}
            compact
            onClose={() => setMediaPickerTab(null)}
            onSelectEmoji={(em) => setDraft((prev) => `${prev}${em}`)}
            onSelectAttachment={(att) => {
              void onSend('', [att]);
            }}
          />
        </div>
      )}

      {/* Input or Live Voice Recorder */}
      {isRecording ? (
        <div className="p-2.5 bg-[var(--sp-surface)] border-t border-[var(--sp-border)] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => finishVoiceRecording('cancel')}
            title="Discard voice clip"
            className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <div className="flex-1 flex items-center gap-[2px] h-5">
              {micLevels.map((lvl, idx) => (
                <span
                  key={idx}
                  style={{ height: `${lvl}%` }}
                  className="flex-1 rounded-full bg-rose-500/80 transition-all duration-75"
                />
              ))}
            </div>
            <span className="text-[11px] font-mono-code font-bold text-rose-600 dark:text-rose-300 tabular-nums shrink-0">
              {formatAudioClock(recordingSeconds)} / 1:00
            </span>
          </div>

          <button
            type="button"
            onClick={() => finishVoiceRecording('attach')}
            title="Stop & preview voice clip"
            className="p-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)] hover:border-[var(--sp-primary)] cursor-pointer shrink-0"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => finishVoiceRecording('send')}
            title="Stop & send voice clip now"
            className="p-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-2 bg-[var(--sp-surface)] border-t border-[var(--sp-border)] flex items-end gap-1 shrink-0">
          <label
            title="Attach image, video, audio, or PDF"
            className="p-1.5 rounded-lg text-[var(--sp-muted)] hover:text-[var(--sp-primary-text)] hover:bg-[var(--sp-surface-alt)] cursor-pointer shrink-0"
          >
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav,application/pdf"
              onChange={handleFileAttach}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setMediaPickerTab((prev) => (prev === 'emoji' ? null : 'emoji'))}
            title="Emojis & Stickers"
            className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${
              mediaPickerTab === 'emoji' || mediaPickerTab === 'sticker'
                ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)]'
                : 'text-[var(--sp-muted)] hover:text-[var(--sp-primary-text)]'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setMediaPickerTab((prev) => (prev === 'gif' ? null : 'gif'))}
            title="Search GIFs & Stickers"
            className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${
              mediaPickerTab === 'gif'
                ? 'bg-[var(--sp-accent-soft)] text-[var(--sp-accent-text)]'
                : 'text-[var(--sp-muted)] hover:text-[#0891B2]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={uploading || sending}
            onClick={() => void startVoiceRecording()}
            title="Record short voice clip (up to 60s)"
            aria-label="Record voice clip"
            className="p-1.5 rounded-lg text-[var(--sp-muted)] hover:text-[#0891B2] hover:bg-[var(--sp-accent-soft)] cursor-pointer shrink-0 disabled:opacity-40"
          >
            <Mic className="w-4 h-4" />
          </button>

          <textarea
            rows={1}
            value={draft}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submitMessage();
              }
            }}
            placeholder={uploading ? 'Uploading...' : 'Message...'}
            className="flex-1 min-w-0 resize-none max-h-24 px-2.5 py-1.5 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] focus:outline-none focus:border-[var(--sp-primary)]"
          />

          <button
            type="button"
            disabled={sending || uploading || (!draft.trim() && pendingAttachments.length === 0)}
            onClick={() => void submitMessage()}
            className="p-1.5 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 disabled:opacity-40 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export const FloatingMessenger: React.FC<FloatingMessengerProps> = ({
  currentUser,
  users,
  threads,
  onlineUserIds,
  typingByThread,
  openThreadIds,
  minimizedThreadIds,
  soundEnabled,
  onToggleSound,
  onOpenThread,
  onMinimizeThread,
  onCloseThread,
  onSendMessage,
  onMarkRead,
  onReactMessage,
  onTypingChange,
  onNavigate,
  onStartCall,
  onOpenCreateGroup,
  onOpenGroupSettings,
  onReplaceGroupLogo,
}) => {
  const [dockExpanded, setDockExpanded] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const maxOpenWindows = useMemo(() => {
    if (isMobile) return 1;
    if (viewportWidth < 1100) return 2;
    return 3;
  }, [isMobile, viewportWidth]);

  const expandedThreads = openThreadIds
    .filter((id) => !minimizedThreadIds.includes(id))
    .map((id) => threads.find((t) => t.id === id))
    .filter((t): t is MessageThread => Boolean(t))
    .slice(-maxOpenWindows);

  const overflowToBubbles = openThreadIds
    .filter((id) => !minimizedThreadIds.includes(id))
    .slice(0, Math.max(0, openThreadIds.filter((id) => !minimizedThreadIds.includes(id)).length - maxOpenWindows));

  const bubbleThreadIds = Array.from(new Set([...minimizedThreadIds, ...overflowToBubbles]));
  const bubbleThreads = bubbleThreadIds
    .map((id) => threads.find((t) => t.id === id))
    .filter((t): t is MessageThread => Boolean(t));

  const totalUnread = threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  const formatLastPreview = (t: MessageThread): string => {
    const last = t.messages[t.messages.length - 1];
    if (!last) return t.isGroup ? `${t.participantIds.length.toLocaleString()} members` : 'Say hello';
    if (last.text) return last.text;
    if (last.attachments?.some((a) => a.kind === 'audio')) return '🎤 Voice clip';
    if (last.attachments?.some((a) => a.kind === 'gif')) return '✨ Sent a GIF';
    if (last.attachments?.some((a) => a.kind === 'sticker')) return '😊 Sent a Sticker';
    return 'Attachment';
  };

  return (
    <>
      {/* Desktop / Tablet Horizontal Dock & Windows */}
      {!isMobile && (
        <div className="fixed bottom-0 right-4 z-40 flex items-end gap-3 pointer-events-none">
          {/* Open Chat Windows (arranged right-to-left via flex-row-reverse) */}
          <div className="flex flex-row-reverse items-end gap-3 pointer-events-auto">
            {expandedThreads.map((thread) => (
              <ChatWindow
                key={thread.id}
                thread={thread}
                currentUser={currentUser}
                users={users}
                onlineUserIds={onlineUserIds}
                typingUserIds={typingByThread[thread.id] || []}
                onMinimize={() => onMinimizeThread(thread.id)}
                onClose={() => onCloseThread(thread.id)}
                onSend={(text, att) => onSendMessage(thread.id, text, att)}
                onMarkRead={() => onMarkRead(thread.id)}
                onReactMessage={(msgId, emoji) => onReactMessage(thread.id, msgId, emoji)}
                onTypingChange={(typing) => onTypingChange(thread.id, typing)}
                onNavigate={onNavigate}
                onStartCall={(mode) => onStartCall(thread.id, mode)}
                onOpenGroupSettings={() => onOpenGroupSettings(thread.id)}
              />
            ))}
          </div>

          {/* Minimized Bubbles & Quick Dock */}
          <div className="pb-4 flex flex-col items-end gap-2.5 pointer-events-auto">
            {dockExpanded && (
              <div className="w-76 rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] shadow-2xl overflow-hidden">
                <div className="px-3.5 py-2.5 bg-[var(--sp-primary)] text-white flex items-center justify-between gap-2">
                  <span className="font-display text-xs font-bold truncate">Sphere. Messenger</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenCreateGroup();
                        setDockExpanded(false);
                      }}
                      title="Create Group Chat (1,000+ Members)"
                      className="px-2 py-1 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-[10px] font-extrabold inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Group</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleSound}
                      title={soundEnabled ? 'Mute sound alerts' : 'Enable sound alerts'}
                      className="p-1 rounded hover:bg-white/15 cursor-pointer"
                    >
                      {soundEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDockExpanded(false)}
                      className="p-1 rounded hover:bg-white/15 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[var(--sp-border-subtle)]">
                  {threads.map((t) => {
                    const peer = users.find((u) => u.id !== currentUser.id && t.participantIds.includes(u.id));
                    const online = peer ? onlineUserIds.includes(peer.id) : false;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onOpenThread(t.id);
                          setDockExpanded(false);
                        }}
                        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-[var(--sp-surface-alt)] text-left cursor-pointer"
                      >
                        <ThreadHeadAvatar thread={t} peer={peer} isOnline={online} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-[var(--sp-ink)] truncate">
                              {t.title || peer?.name || 'Conversation'}
                            </span>
                            {t.unreadCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#06B6D4] text-slate-950 text-[10px] font-bold">
                                {t.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--sp-muted)] truncate">
                            {t.isGroup && (
                              <span className="text-[var(--sp-primary-text)] font-semibold mr-1">
                                {t.participantIds.length.toLocaleString()} ·
                              </span>
                            )}
                            {formatLastPreview(t)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Minimized Circular Avatar Chat Heads */}
            {bubbleThreads.map((t) => {
              const peer = users.find((u) => u.id !== currentUser.id && t.participantIds.includes(u.id));
              const online = peer ? onlineUserIds.includes(peer.id) : false;
              const label = t.title || peer?.name || 'Member';
              return (
                <div key={t.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => onOpenThread(t.id)}
                    title={t.isGroup ? `Restore "${label}" (${t.participantIds.length.toLocaleString()} members)` : `Restore chat with ${label}`}
                    className="rounded-full p-0.5 bg-[var(--sp-surface)] border-2 border-[var(--sp-primary)] shadow-lg hover:scale-105 transition-transform cursor-pointer"
                  >
                    <ThreadHeadAvatar thread={t} peer={peer} isOnline={online} size="lg" />
                  </button>
                  {t.unreadCount > 0 && (
                    <span className="absolute -top-1 -left-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                      {t.unreadCount}
                    </span>
                  )}
                  {t.isGroup && (
                    <label
                      title="Replace group logo in chat head"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 border border-white hidden group-hover:flex items-center justify-center cursor-pointer shadow-sm"
                    >
                      <Camera className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onReplaceGroupLogo(t.id, file);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => onCloseThread(t.id)}
                    title="Close bubble"
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] hidden group-hover:flex items-center justify-center cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Dock Toggle Button */}
            <button
              type="button"
              onClick={() => setDockExpanded((v) => !v)}
              title="Open Sphere. Messenger Dock"
              className="relative w-12 h-12 rounded-full bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white shadow-xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
            >
              <MessageCircle className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#06B6D4] text-slate-950 text-[10px] font-extrabold tabular-nums">
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Full-Screen Chat Sheet */}
      {isMobile && expandedThreads[0] && (
        <ChatWindow
          thread={expandedThreads[0]}
          currentUser={currentUser}
          users={users}
          onlineUserIds={onlineUserIds}
          typingUserIds={typingByThread[expandedThreads[0].id] || []}
          isMobileSheet
          onMinimize={() => onMinimizeThread(expandedThreads[0].id)}
          onClose={() => onCloseThread(expandedThreads[0].id)}
          onSend={(text, att) => onSendMessage(expandedThreads[0].id, text, att)}
          onMarkRead={() => onMarkRead(expandedThreads[0].id)}
          onReactMessage={(msgId, emoji) => onReactMessage(expandedThreads[0].id, msgId, emoji)}
          onTypingChange={(typing) => onTypingChange(expandedThreads[0].id, typing)}
          onNavigate={onNavigate}
          onStartCall={(mode) => onStartCall(expandedThreads[0].id, mode)}
          onOpenGroupSettings={() => onOpenGroupSettings(expandedThreads[0].id)}
        />
      )}
    </>
  );
};
