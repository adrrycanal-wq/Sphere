import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  CheckCheck,
  ExternalLink,
  Languages,
  MessageCircle,
  MonitorUp,
  Paperclip,
  Plus,
  Send,
  Smile,
  Sparkles,
  Users,
  Video,
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
import { VoiceAudioBubble } from './VoiceAudioBubble';

interface MessagesViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  threads: MessageThread[];
  onlineUserIds: string[];
  typingByThread: Record<string, string[]>;
  initialThreadId?: string;
  onSendMessage: (
    threadId: string,
    text: string,
    attachments?: AttachmentItem[]
  ) => Promise<void>;
  onMarkRead: (threadId: string) => void;
  onPopOutThread: (threadId: string) => void;
  onToggleAutoTranslate: () => void;
  onNavigate: (route: NavRoute) => void;
  onStartCall: (threadId: string, mode: 'video' | 'screen') => void;
  onOpenCreateGroup: () => void;
  onOpenGroupSettings: (threadId: string) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUser,
  users,
  threads,
  onlineUserIds,
  typingByThread,
  initialThreadId,
  onSendMessage,
  onMarkRead,
  onPopOutThread,
  onToggleAutoTranslate,
  onNavigate,
  onStartCall,
  onOpenCreateGroup,
  onOpenGroupSettings,
}) => {
  const { openImage } = useImageViewer();
  const [selectedId, setSelectedId] = useState<string>(initialThreadId || threads[0]?.id || '');
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [sending, setSending] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'gif' | 'sticker' | null>(null);

  useEffect(() => {
    if (initialThreadId) setSelectedId(initialThreadId);
  }, [initialThreadId]);

  const activeThread = threads.find((t) => t.id === selectedId) || threads[0];

  useEffect(() => {
    if (activeThread && activeThread.unreadCount > 0) {
      onMarkRead(activeThread.id);
    }
  }, [activeThread?.id]);

  const activePeers = activeThread
    ? activeThread.participantIds
        .filter((id) => id !== currentUser.id)
        .map((id) => users.find((u) => u.id === id))
        .filter((u): u is UserProfile => Boolean(u))
    : [];

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Read error'));
      reader.readAsDataURL(file);
    });
    const uploaded = await apiUploadFile({
      fileName: file.name,
      mimeType: file.type,
      dataBase64,
    });
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        name: uploaded.name,
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        kind: file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'file',
      },
    ]);
    e.target.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || (!draft.trim() && attachments.length === 0) || sending) return;
    setSending(true);
    try {
      await onSendMessage(
        activeThread.id,
        draft.trim(),
        attachments.length > 0 ? attachments : undefined
      );
      setDraft('');
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
      {/* Thread List */}
      <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-[var(--sp-border)] flex flex-col">
        <div className="p-4 border-b border-[var(--sp-border-subtle)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">Messages</h1>
            <p className="text-[11px] text-[var(--sp-muted)]">Real-time Messenger inbox</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenCreateGroup}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Group (1,000+)</span>
            </button>
            <button
              type="button"
              onClick={onToggleAutoTranslate}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer border ${
                currentUser.autoTranslate
                  ? 'bg-[var(--sp-accent-soft)] border-[var(--sp-accent-soft-border)] text-[var(--sp-accent-text)]'
                  : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)] text-[var(--sp-muted)]'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{currentUser.autoTranslate ? 'Auto On' : 'Translate'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--sp-border-subtle)]">
          {threads.map((t) => {
            const peer = users.find((u) => u.id !== currentUser.id && t.participantIds.includes(u.id));
            const online = peer ? onlineUserIds.includes(peer.id) : false;
            const last = t.messages[t.messages.length - 1];
            const selected = activeThread?.id === t.id;
            const previewText = last
              ? last.text ||
                (last.attachments?.some((a) => a.kind === 'audio')
                  ? '🎤 Voice clip'
                  : last.attachments?.some((a) => a.kind === 'gif')
                    ? '✨ GIF'
                    : last.attachments?.some((a) => a.kind === 'sticker')
                      ? '😊 Sticker'
                      : 'Attachment')
              : 'No messages yet';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedId(t.id);
                  if (t.unreadCount > 0) onMarkRead(t.id);
                }}
                className={`w-full p-3.5 flex items-center gap-3 text-left cursor-pointer transition-colors ${
                  selected
                    ? 'bg-[var(--sp-primary-soft)]'
                    : 'hover:bg-[var(--sp-surface-alt)]'
                }`}
              >
                {t.isGroup ? (
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white"
                    style={{ backgroundColor: t.avatar ? undefined : t.avatarColor || '#4F46E5' }}
                  >
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.title || 'Group'} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                  </div>
                ) : (
                  <UserAvatar user={peer} size="md" isOnline={online} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--sp-ink)] truncate">
                      {t.title || peer?.name || 'Member'}
                    </span>
                    {t.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#06B6D4] text-slate-950 text-[10px] font-bold">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--sp-muted)] truncate mt-0.5">
                    {t.isGroup && (
                      <span className="text-[var(--sp-primary-text)] font-semibold mr-1">
                        {t.participantIds.length.toLocaleString()} members ·
                      </span>
                    )}
                    {previewText}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Active Thread */}
      <section className="md:col-span-8 flex flex-col">
        {activeThread ? (
          <>
            <div className="px-5 py-3.5 border-b border-[var(--sp-border-subtle)] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (activeThread.isGroup) {
                    onOpenGroupSettings(activeThread.id);
                  } else if (activePeers[0]) {
                    onNavigate({ page: 'profile', userId: activePeers[0].id, tab: 'timeline' });
                  }
                }}
                className="flex items-center gap-3 text-left cursor-pointer hover:opacity-85"
              >
                {activeThread.isGroup ? (
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white"
                    style={{
                      backgroundColor: activeThread.avatar
                        ? undefined
                        : activeThread.avatarColor || '#4F46E5',
                    }}
                  >
                    {activeThread.avatar ? (
                      <img
                        src={activeThread.avatar}
                        alt={activeThread.title || 'Group'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                  </div>
                ) : (
                  <UserAvatar
                    user={activePeers[0]}
                    size="md"
                    isOnline={activePeers.some((u) => onlineUserIds.includes(u.id))}
                  />
                )}
                <div>
                  <div className="font-display text-sm font-bold text-[var(--sp-ink)]">
                    {activeThread.title || activePeers.map((u) => u.name).join(', ')}
                  </div>
                  <div className="text-[11px] text-[var(--sp-muted)]">
                    {(typingByThread[activeThread.id] || []).length > 0
                      ? 'Typing now...'
                      : activeThread.isGroup
                        ? `${activeThread.participantIds.length.toLocaleString()} / ${(activeThread.maxMembers || 2000).toLocaleString()} members · Tap to replace logo`
                        : activePeers.some((u) => onlineUserIds.includes(u.id))
                          ? 'Active now'
                          : activePeers[0]?.location || 'Sphere. Member'}
                  </div>
                </div>
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                {activeThread.isGroup && (
                  <button
                    type="button"
                    onClick={() => onOpenGroupSettings(activeThread.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-xs font-semibold text-[var(--sp-ink)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
                    <span>Group Logo &amp; Members</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onStartCall(activeThread.id, 'video')}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartCall(activeThread.id, 'screen')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MonitorUp className="w-3.5 h-3.5" />
                  <span>Share Screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPopOutThread(activeThread.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-xs font-semibold text-[var(--sp-ink)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--sp-accent-text)]" />
                  <span>Pop Out</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[var(--sp-bg)]">
              {activeThread.messages.map((m) => {
                const isMine = m.senderId === currentUser.id;
                const sender = users.find((u) => u.id === m.senderId);
                const isRead = (m.readBy || []).some((id) => id !== currentUser.id);
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex items-end gap-2 max-w-[78%] ${isMine ? 'flex-row-reverse' : ''}`}>
                      {!isMine && <UserAvatar user={sender} size="xs" />}
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMine
                            ? 'bg-[var(--sp-primary)] text-white rounded-br-sm'
                            : 'bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-ink)] rounded-bl-sm'
                        }`}
                      >
                        {m.text && <p className="whitespace-pre-line">{m.text}</p>}
                        {m.attachments?.map((a) => {
                          const threadGallery = activeThread.messages
                            .flatMap((msgItem) => msgItem.attachments || [])
                            .filter((item) => item.kind === 'image' || item.kind === 'gif' || item.kind === 'sticker')
                            .map((item) => ({
                              src: item.url,
                              alt: item.label || item.name,
                              title: item.label || item.name,
                              subtitle: activeThread.title || activePeers.map((u) => u.name).join(', '),
                            }));

                          if (a.kind === 'image') {
                            return (
                              <img
                                key={a.id}
                                src={a.url}
                                alt={a.name}
                                onClick={() =>
                                  openImage({
                                    src: a.url,
                                    alt: a.name,
                                    title: a.name,
                                    subtitle: `${sender?.name || 'Member'} · ${m.timestamp}`,
                                    badge: 'Messenger Photo',
                                    gallery: threadGallery,
                                  })
                                }
                                className="mt-2 max-h-56 rounded-lg cursor-zoom-in hover:opacity-95 transition-opacity"
                              />
                            );
                          }
                          if (a.kind === 'gif') {
                            return (
                              <img
                                key={a.id}
                                src={a.url}
                                alt={a.label || a.name}
                                onClick={() =>
                                  openImage({
                                    src: a.url,
                                    alt: a.label || a.name,
                                    title: a.label || a.name,
                                    subtitle: `GIF · ${sender?.name || 'Member'}`,
                                    badge: 'Messenger GIF',
                                    gallery: threadGallery,
                                  })
                                }
                                className="mt-2 max-h-48 rounded-xl shadow-xs cursor-zoom-in hover:opacity-95 transition-opacity"
                              />
                            );
                          }
                          if (a.kind === 'sticker') {
                            return (
                              <img
                                key={a.id}
                                src={a.url}
                                alt={a.label || a.name}
                                onClick={() =>
                                  openImage({
                                    src: a.url,
                                    alt: a.label || a.name,
                                    title: a.label || a.name,
                                    subtitle: `Sticker · ${sender?.name || 'Member'}`,
                                    badge: 'Messenger Sticker',
                                    gallery: threadGallery,
                                  })
                                }
                                className="mt-1 w-28 h-28 object-contain cursor-zoom-in hover:scale-105 transition-transform"
                              />
                            );
                          }
                          return a.kind === 'video' ? (
                            <video key={a.id} src={a.url} controls className="mt-2 max-h-56 rounded-lg" />
                          ) : a.kind === 'audio' ? (
                            <div key={a.id} className={m.text ? 'mt-2' : ''}>
                              <VoiceAudioBubble attachment={a} isMine={isMine} />
                            </div>
                          ) : (
                            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block underline text-xs mt-1">
                              📎 {a.name}
                            </a>
                          );
                        })}
                        {!isMine && m.text && (
                          <TranslateControl
                            text={m.text}
                            preferredLanguage={currentUser.preferredLanguage || 'English'}
                            sourceLanguageHint={m.language}
                            autoTranslate={currentUser.autoTranslate}
                            className="mt-1.5"
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-[var(--sp-muted)] mt-1 flex items-center gap-1 px-1">
                      <span>{m.timestamp}</span>
                      {isMine && (isRead ? <CheckCheck className="w-3 h-3 text-[var(--sp-accent-text)]" /> : <Check className="w-3 h-3" />)}
                    </div>
                  </div>
                );
              })}
            </div>

            {pickerTab && (
              <div className="px-4 py-2 border-t border-[var(--sp-border-subtle)] bg-[var(--sp-bg)] flex justify-start">
                <ChatMediaPicker
                  initialTab={pickerTab}
                  onClose={() => setPickerTab(null)}
                  onSelectEmoji={(em) => setDraft((prev) => `${prev}${em}`)}
                  onSelectAttachment={(att) => {
                    void onSendMessage(activeThread.id, '', [att]);
                  }}
                />
              </div>
            )}

            <form
              onSubmit={handleSend}
              className="p-4 border-t border-[var(--sp-border)] bg-[var(--sp-surface)] flex items-center gap-2"
            >
              <label className="p-2 rounded-lg text-[var(--sp-muted)] hover:text-[var(--sp-primary-text)] cursor-pointer">
                <Paperclip className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav,application/pdf"
                  onChange={handleAttach}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setPickerTab((prev) => (prev === 'emoji' ? null : 'emoji'))}
                title="Emojis & Stickers"
                className={`p-2 rounded-lg cursor-pointer ${
                  pickerTab === 'emoji' || pickerTab === 'sticker'
                    ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)]'
                    : 'text-[var(--sp-muted)] hover:text-[var(--sp-primary-text)]'
                }`}
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPickerTab((prev) => (prev === 'gif' ? null : 'gif'))}
                title="Search GIFs & Stickers"
                className={`p-2 rounded-lg cursor-pointer ${
                  pickerTab === 'gif'
                    ? 'bg-[var(--sp-accent-soft)] text-[var(--sp-accent-text)]'
                    : 'text-[var(--sp-muted)] hover:text-[#0891B2]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 px-3.5 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] focus:outline-none focus:border-[var(--sp-primary)]"
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && attachments.length === 0)}
                className="px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--sp-muted)]">
            <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm font-semibold">Select a conversation or start a 1,000+ member group chat.</p>
          </div>
        )}
      </section>
    </div>
  );
};
