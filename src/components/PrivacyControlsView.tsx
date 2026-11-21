import React, { useState } from 'react';
import { Check, Lock, Shield, Trash2, UserCheck, X } from 'lucide-react';
import {
  PrivacyLevel,
  SocialPost,
  TagWallPermission,
  UserProfile,
} from '../types/social';
import { apiDecideTag, apiDecideWallPost, apiUpdateUser } from '../utils/api';
import {
  GLOBAL_PRIVACY_FRAMEWORKS,
  getPrivacyFrameworkForCountry,
} from '../utils/discovery';

interface PrivacyControlsViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  posts: SocialPost[];
  onRefresh: () => Promise<void>;
}

export const PrivacyControlsView: React.FC<PrivacyControlsViewProps> = ({
  currentUser,
  users,
  posts,
  onRefresh,
}) => {
  const [accountPrivacy, setAccountPrivacy] = useState<PrivacyLevel>(currentUser.privacy);
  const [tagEnabled, setTagEnabled] = useState(currentUser.taggingSettings?.enabled ?? true);
  const [whoCanTag, setWhoCanTag] = useState<TagWallPermission>(
    currentUser.taggingSettings?.whoCanTag ?? 'friends'
  );
  const [tagApproval, setTagApproval] = useState(
    currentUser.taggingSettings?.requireApproval ?? true
  );

  const [wallEnabled, setWallEnabled] = useState(
    currentUser.wallSharingSettings?.enabled ?? true
  );
  const [whoCanPost, setWhoCanPost] = useState<TagWallPermission>(
    currentUser.wallSharingSettings?.whoCanPost ?? 'friends'
  );
  const [wallApproval, setWallApproval] = useState(
    currentUser.wallSharingSettings?.requireApproval ?? true
  );

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const framework = getPrivacyFrameworkForCountry(currentUser.country);

  const pendingTags = posts.filter((p) => p.pendingTagUserIds?.includes(currentUser.id));
  const approvedTags = posts.filter((p) => p.approvedTagUserIds?.includes(currentUser.id));
  const pendingWallPosts = posts.filter(
    (p) => p.targetProfileId === currentUser.id && p.wallApproved === false
  );
  const wallPostsByOthers = posts.filter(
    (p) =>
      p.targetProfileId === currentUser.id &&
      p.authorId !== currentUser.id &&
      p.wallApproved !== false
  );

  const handleSaveSettings = async () => {
    setSaving(true);
    setSavedNotice(null);
    try {
      await apiUpdateUser(currentUser.id, {
        privacy: accountPrivacy,
        taggingSettings: {
          enabled: tagEnabled,
          whoCanTag,
          requireApproval: tagApproval,
        },
        wallSharingSettings: {
          enabled: wallEnabled,
          whoCanPost,
          requireApproval: wallApproval,
        },
      });
      await onRefresh();
      setSavedNotice('Privacy, tagging, and MySpace wall settings saved and enforced.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-2">
        <div className="text-xs font-mono-code font-semibold text-[var(--sp-accent-text)] uppercase flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span>Global Data Privacy Protection ({framework.shortCode})</span>
        </div>
        <h1 className="font-display text-xl font-extrabold text-[var(--sp-ink)]">
          Account Visibility, Tagging &amp; MySpace Wall Controls
        </h1>
        <p className="text-xs text-[var(--sp-muted)] leading-relaxed">
          Applicable regional framework: <strong>{framework.lawName}</strong>. Sphere. honors data privacy laws worldwide ({GLOBAL_PRIVACY_FRAMEWORKS.slice(0, 6).map((f) => f.shortCode).join(', ')}, and more). Every restriction below is enforced on both the interface and server endpoints.
        </p>
      </section>

      {savedNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
          {savedNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. Account Visibility */}
        <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--sp-primary-text)]" />
            <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
              Account Viewing Privacy
            </h2>
          </div>
          <p className="text-xs text-[var(--sp-muted)]">
            Control who can view your profile details, timeline Echoes, and Frames when visiting your account.
          </p>
          <div className="space-y-2">
            {(
              [
                { id: 'public', label: 'Public', desc: 'Anyone on Sphere. can view' },
                {
                  id: 'friends_of_friends',
                  label: 'Friends of Friends',
                  desc: 'Your circle and mutual connections',
                },
                { id: 'friends_only', label: 'Friends Only', desc: 'Confirmed friends only' },
                { id: 'only_me', label: 'Only Me', desc: 'Strictly locked to your account' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${
                  accountPrivacy === opt.id
                    ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)]'
                    : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border-subtle)]'
                }`}
              >
                <input
                  type="radio"
                  name="accountPrivacy"
                  checked={accountPrivacy === opt.id}
                  onChange={() => setAccountPrivacy(opt.id)}
                  className="mt-0.5 accent-[#4F46E5]"
                />
                <div>
                  <div className="text-xs font-bold text-[var(--sp-ink)]">{opt.label}</div>
                  <div className="text-[11px] text-[var(--sp-muted)]">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* 2. Profile Tagging Controls */}
        <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[var(--sp-accent-text)]" />
            <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
              Profile Tagging Settings
            </h2>
          </div>

          <label className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--sp-surface-alt)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer">
            <span>Enable profile tagging</span>
            <input
              type="checkbox"
              checked={tagEnabled}
              onChange={(e) => setTagEnabled(e.target.checked)}
              className="accent-[#4F46E5]"
            />
          </label>

          <div>
            <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
              Who can tag you in posts?
            </label>
            <select
              disabled={!tagEnabled}
              value={whoCanTag}
              onChange={(e) => setWhoCanTag(e.target.value as TagWallPermission)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] disabled:opacity-50"
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends</option>
              <option value="no_one">No One</option>
            </select>
          </div>

          <label className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--sp-surface-alt)] text-xs text-[var(--sp-ink-2)] cursor-pointer">
            <input
              type="checkbox"
              disabled={!tagEnabled}
              checked={tagApproval}
              onChange={(e) => setTagApproval(e.target.checked)}
              className="mt-0.5 accent-[#4F46E5]"
            />
            <span>Require my approval before tagged posts appear on my MySpace profile</span>
          </label>
        </section>

        {/* 3. MySpace Wall Sharing Controls */}
        <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--sp-primary-text)]" />
            <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
              MySpace Wall Sharing Settings
            </h2>
          </div>

          <label className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--sp-surface-alt)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer">
            <span>Allow others to post on my MySpace wall</span>
            <input
              type="checkbox"
              checked={wallEnabled}
              onChange={(e) => setWallEnabled(e.target.checked)}
              className="accent-[#4F46E5]"
            />
          </label>

          <div>
            <label className="block text-xs font-semibold text-[var(--sp-ink-2)] mb-1">
              Who can share posts directly to your MySpace?
            </label>
            <select
              disabled={!wallEnabled}
              value={whoCanPost}
              onChange={(e) => setWhoCanPost(e.target.value as TagWallPermission)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] disabled:opacity-50"
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends</option>
              <option value="no_one">No One</option>
            </select>
          </div>

          <label className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--sp-surface-alt)] text-xs text-[var(--sp-ink-2)] cursor-pointer">
            <input
              type="checkbox"
              disabled={!wallEnabled}
              checked={wallApproval}
              onChange={(e) => setWallApproval(e.target.checked)}
              className="mt-0.5 accent-[#4F46E5]"
            />
            <span>Require my approval before shared posts appear on my MySpace wall</span>
          </label>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveSettings}
          className="px-6 py-2.5 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
        >
          {saving ? 'Saving Privacy Settings...' : 'Save Privacy & Wall Controls'}
        </button>
      </div>

      {/* Pending Approvals & Tagged / Wall Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
            Pending Tag Approvals ({pendingTags.length})
          </h2>
          {pendingTags.length === 0 ? (
            <p className="text-xs text-[var(--sp-muted)]">No pending tag requests right now.</p>
          ) : (
            <div className="space-y-2">
              {pendingTags.map((p) => {
                const author = users.find((u) => u.id === p.authorId);
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2"
                  >
                    <div className="text-xs">
                      <strong>{author?.name}</strong> tagged you: “{p.content.slice(0, 110)}”
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiDecideTag(p.id, currentUser.id, 'approve');
                          await onRefresh();
                        }}
                        className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve Tag
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiDecideTag(p.id, currentUser.id, 'reject');
                          await onRefresh();
                        }}
                        className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {approvedTags.length > 0 && (
            <div className="pt-3 border-t border-[var(--sp-border-subtle)] space-y-2">
              <div className="text-xs font-bold text-[var(--sp-ink-2)]">
                Posts You Are Tagged In ({approvedTags.length})
              </div>
              {approvedTags.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-[var(--sp-surface-alt)]"
                >
                  <span className="truncate">{p.content}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiDecideTag(p.id, currentUser.id, 'remove');
                      await onRefresh();
                    }}
                    className="text-red-500 font-semibold shrink-0 cursor-pointer hover:underline"
                  >
                    Remove Tag
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">
            Pending MySpace Wall Approvals ({pendingWallPosts.length})
          </h2>
          {pendingWallPosts.length === 0 ? (
            <p className="text-xs text-[var(--sp-muted)]">No pending MySpace wall shares.</p>
          ) : (
            <div className="space-y-2">
              {pendingWallPosts.map((p) => {
                const author = users.find((u) => u.id === p.authorId);
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2"
                  >
                    <div className="text-xs">
                      <strong>{author?.name}</strong> wants to share on your MySpace: “{p.content}”
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiDecideWallPost(p.id, currentUser.id, 'approve');
                          await onRefresh();
                        }}
                        className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve on Wall
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiDecideWallPost(p.id, currentUser.id, 'reject');
                          await onRefresh();
                        }}
                        className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {wallPostsByOthers.length > 0 && (
            <div className="pt-3 border-t border-[var(--sp-border-subtle)] space-y-2">
              <div className="text-xs font-bold text-[var(--sp-ink-2)]">
                Posts Shared on Your MySpace by Others ({wallPostsByOthers.length})
              </div>
              {wallPostsByOthers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-[var(--sp-surface-alt)]"
                >
                  <span className="truncate">{p.content}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiDecideWallPost(p.id, currentUser.id, 'remove');
                      await onRefresh();
                    }}
                    className="text-red-500 font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer hover:underline"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
