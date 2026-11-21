import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Globe2,
  ImagePlus,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { MessageThread, UserProfile } from '../types/social';
import {
  GroupMemberSummary,
  apiAddThreadMembers,
  apiCreateGroupThread,
  apiGetThreadMembers,
  fetchGlobalDirectory,
  apiUpdateThreadSettings,
  apiUploadFile,
} from '../utils/api';
import { GLOBAL_DIRECTORY_COUNTRIES } from '../utils/globalDirectory';
import { UserAvatar } from './Media';

const GROUP_COLORS = [
  '#4F46E5',
  '#06B6D4',
  '#DB2777',
  '#059669',
  '#EA580C',
  '#7C3AED',
  '#1E293B',
];

async function uploadGroupLogoFile(file: File): Promise<string> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
  const uploaded = await apiUploadFile({
    fileName: file.name,
    mimeType: file.type,
    dataBase64,
  });
  return uploaded.url;
}

interface CreateGroupChatModalProps {
  open: boolean;
  currentUser: UserProfile;
  users: UserProfile[];
  onClose: () => void;
  onCreated: (thread: MessageThread) => Promise<void> | void;
}

export const CreateGroupChatModal: React.FC<CreateGroupChatModalProps> = ({
  open,
  currentUser,
  users,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarColor, setAvatarColor] = useState('#4F46E5');
  const [maxMembers, setMaxMembers] = useState<number>(2000);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAddCount, setBulkAddCount] = useState<number>(1000);
  const [bulkCountry, setBulkCountry] = useState<string>('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [directoryMatches, setDirectoryMatches] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      void fetchGlobalDirectory({
        viewerId: currentUser.id,
        q: searchQuery,
        limit: 18,
      })
        .then((res) => {
          if (!cancelled) setDirectoryMatches(res.items);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, searchQuery, currentUser.id]);

  const localCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter((u) => u.id !== currentUser.id)
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          u.location.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [users, currentUser.id, searchQuery]);

  const combinedCandidates = useMemo(() => {
    const seen = new Set<string>([currentUser.id]);
    const list: UserProfile[] = [];
    for (const u of [...localCandidates, ...directoryMatches]) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      list.push(u);
    }
    return list;
  }, [localCandidates, directoryMatches, currentUser.id]);

  if (!open) return null;

  const estimatedTotal = Math.min(maxMembers, 1 + selectedIds.length + bulkAddCount);

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingLogo(true);
    try {
      const url = await uploadGroupLogoFile(file);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload group logo.');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Please enter a Group Chat name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiCreateGroupThread({
        creatorId: currentUser.id,
        title: title.trim(),
        participantIds: selectedIds,
        avatar: avatarUrl || undefined,
        avatarColor,
        maxMembers: Math.max(1000, maxMembers),
        autoAddCount: bulkAddCount,
        autoAddCountry: bulkCountry,
      });
      await onCreated(res.thread);
      setTitle('');
      setAvatarUrl('');
      setSelectedIds([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create group chat.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] flex flex-col bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#A5F3FC]" />
            <div>
              <h2 className="font-display text-base font-bold">Create Large Group Chat (1,000+ Members)</h2>
              <p className="text-[11px] text-white/80">
                Supports custom chat-head logos &amp; 1,000 to 5,000 members
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Group Logo + Title */}
          <div className="flex items-center gap-4">
            <label
              title="Upload Group Chat Head Logo"
              className="relative w-16 h-16 rounded-full border-2 border-dashed border-[var(--sp-primary)] flex items-center justify-center overflow-hidden cursor-pointer shrink-0 group"
              style={{ backgroundColor: avatarUrl ? undefined : avatarColor }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Group logo" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-7 h-7 text-white" />
              )}
              <span className="absolute inset-0 bg-slate-950/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoFile}
                className="hidden"
              />
            </label>

            <div className="flex-1 space-y-2">
              <div>
                <label className="block text-xs font-bold text-[var(--sp-ink)] mb-1">
                  Group Chat Name
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Labo Riders Club · Global Builders · Bake Club"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[var(--sp-muted)]">Head Color:</span>
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full cursor-pointer border-2 ${
                      avatarColor === c ? 'border-white ring-2 ring-[var(--sp-primary)]' : 'border-transparent'
                    }`}
                  />
                ))}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="text-[11px] text-red-500 underline cursor-pointer ml-1"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Capacity + Instant 1000+ Directory Fill */}
          <div className="p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
                <Globe2 className="w-4 h-4 text-[#06B6D4]" />
                <span>Scale &amp; Bulk Directory Invite</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] text-[11px] font-bold tabular-nums">
                {estimatedTotal.toLocaleString()} / {maxMembers.toLocaleString()} members
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--sp-muted)] mb-1">
                  Group Capacity (Min 1,000)
                </label>
                <select
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(Math.max(1000, Number(e.target.value)))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                >
                  <option value={1000}>1,000 members</option>
                  <option value={2000}>2,000 members</option>
                  <option value={5000}>5,000 members</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--sp-muted)] mb-1">
                  Auto-Invite Directory Members
                </label>
                <select
                  value={bulkAddCount}
                  onChange={(e) => setBulkAddCount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                >
                  <option value={0}>Manual pick only</option>
                  <option value={1000}>+1,000 members</option>
                  <option value={1500}>+1,500 members</option>
                  <option value={2500}>+2,500 members</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--sp-muted)] mb-1">
                  Region / Country Filter
                </label>
                <select
                  value={bulkCountry}
                  onChange={(e) => setBulkCountry(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                >
                  <option value="All">All Countries (Global)</option>
                  {GLOBAL_DIRECTORY_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Hand-Pick Members */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--sp-ink)]">
                Add Specific Friends or Global Members ({selectedIds.length} picked)
              </label>
              {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--sp-muted)]" />}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--sp-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends or 100,000+ global users..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>

            <div className="max-h-44 overflow-y-auto border border-[var(--sp-border-subtle)] rounded-xl divide-y divide-[var(--sp-border-subtle)]">
              {combinedCandidates.map((u) => {
                const picked = selectedIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setSelectedIds((prev) =>
                        prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                      )
                    }
                    className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer ${
                      picked ? 'bg-[var(--sp-primary-soft)]' : 'hover:bg-[var(--sp-surface-alt)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar user={u} size="xs" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--sp-ink)] truncate">{u.name}</div>
                        <div className="text-[10px] text-[var(--sp-muted)] truncate">
                          {u.handle} · {u.location}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                        picked
                          ? 'bg-[var(--sp-primary)] border-[var(--sp-primary)] text-white'
                          : 'border-[var(--sp-border)]'
                      }`}
                    >
                      {picked && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingLogo}
              className="flex-1 py-2.5 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? 'Creating Group...'
                  : `Create Group Chat (${estimatedTotal.toLocaleString()} Members)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GroupSettingsModalProps {
  thread: MessageThread | null;
  currentUser: UserProfile;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  thread,
  currentUser,
  onClose,
  onUpdated,
}) => {
  const [title, setTitle] = useState(thread?.title || '');
  const [avatarUrl, setAvatarUrl] = useState(thread?.avatar || '');
  const [avatarColor, setAvatarColor] = useState(thread?.avatarColor || '#4F46E5');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [totalMembers, setTotalMembers] = useState(thread?.participantIds.length || 0);
  const [maxMembers, setMaxMembers] = useState(Math.max(1000, thread?.maxMembers || 2000));
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!thread) return;
    setTitle(thread.title || '');
    setAvatarUrl(thread.avatar || '');
    setAvatarColor(thread.avatarColor || '#4F46E5');
    setTotalMembers(thread.participantIds.length);
    setMaxMembers(Math.max(1000, thread.maxMembers || 2000));
  }, [thread?.id, thread?.avatar, thread?.title, thread?.participantIds.length]);

  useEffect(() => {
    if (!thread) return;
    let cancelled = false;
    setLoadingMembers(true);
    const t = window.setTimeout(() => {
      void apiGetThreadMembers(thread.id, { page: 1, limit: 40, q: memberSearch })
        .then((res) => {
          if (cancelled) return;
          setMembers(res.members);
          setTotalMembers(res.totalMembers);
          setMaxMembers(res.maxMembers);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingMembers(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [thread?.id, thread?.participantIds.length, memberSearch]);

  if (!thread) return null;

  const handleReplaceLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setInfo(null);
    setUploadingLogo(true);
    try {
      const url = await uploadGroupLogoFile(file);
      setAvatarUrl(url);
      await apiUpdateThreadSettings(thread.id, {
        userId: currentUser.id,
        avatar: url,
      });
      await onUpdated();
      setInfo('Group chat head logo updated across all chat windows and chat heads!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload group logo.');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      await apiUpdateThreadSettings(thread.id, {
        userId: currentUser.id,
        title: title.trim() || thread.title,
        avatar: avatarUrl,
        avatarColor,
      });
      await onUpdated();
      setInfo('Group settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkExpand = async (count: number) => {
    setError(null);
    setInfo(null);
    setAddingMembers(true);
    try {
      const res = await apiAddThreadMembers(thread.id, { autoAddCount: count });
      await onUpdated();
      setTotalMembers(res.thread.participantIds.length);
      setInfo(`Group now has ${res.thread.participantIds.length.toLocaleString()} members.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add members.');
    } finally {
      setAddingMembers(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-[#A5F3FC]" />
            <div>
              <h2 className="font-display text-base font-bold">Group Chat Logo &amp; Members</h2>
              <p className="text-[11px] text-white/80">
                {totalMembers.toLocaleString()} / {maxMembers.toLocaleString()} members
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {info && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
              {info}
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Replaceable Logo Section */}
          <form onSubmit={handleSaveDetails} className="space-y-3">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full border-2 border-[var(--sp-primary)] overflow-hidden flex items-center justify-center shrink-0"
                style={{ backgroundColor: avatarUrl ? undefined : avatarColor }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Group chat logo" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-7 h-7 text-white" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{uploadingLogo ? 'Uploading...' : 'Replace Chat Head Logo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleReplaceLogo}
                      className="hidden"
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        setAvatarUrl('');
                        await apiUpdateThreadSettings(thread.id, {
                          userId: currentUser.id,
                          avatar: '',
                        });
                        await onUpdated();
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--sp-border)] text-xs text-red-500 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--sp-muted)]">Accent:</span>
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAvatarColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-4 h-4 rounded-full cursor-pointer border ${
                        avatarColor === c ? 'border-white ring-2 ring-[var(--sp-primary)]' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Group chat name"
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>

          {/* Scale / Bulk Invite Members */}
          <div className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs">
              <div className="font-bold text-[var(--sp-ink)]">
                {totalMembers.toLocaleString()} Active Members
              </div>
              <div className="text-[10px] text-[var(--sp-muted)]">
                Capacity up to {maxMembers.toLocaleString()} participants
              </div>
            </div>
            <div className="flex gap-1.5">
              {totalMembers < 1000 && (
                <button
                  type="button"
                  disabled={addingMembers}
                  onClick={() => void handleBulkExpand(1000 - totalMembers + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-primary)] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Reach 1,000+ Members</span>
                </button>
              )}
              <button
                type="button"
                disabled={addingMembers || totalMembers >= maxMembers}
                onClick={() => void handleBulkExpand(250)}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-surface)] text-[var(--sp-ink)] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+250 Global</span>
              </button>
            </div>
          </div>

          {/* Member Roster Browser */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--sp-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search group members..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-[var(--sp-border-subtle)] rounded-xl divide-y divide-[var(--sp-border-subtle)]">
              {loadingMembers && members.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--sp-muted)]">Loading members...</div>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--sp-ink)] truncate">
                        {m.name}{' '}
                        {m.isAdmin && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] text-[9px]">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--sp-muted)] truncate">
                        {m.handle} · {m.location}
                      </div>
                    </div>
                    {m.online && (
                      <span className="text-[10px] font-semibold text-emerald-500 shrink-0">Online</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
