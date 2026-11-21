import React, { useMemo, useState } from 'react';
import { Flag, HeartHandshake, MessageSquare, Plus, Shield } from 'lucide-react';
import { AnonymousPost, AnonymousTopic, UserProfile } from '../types/social';
import {
  apiCreateAnonymousPost,
  apiReplyAnonymousPost,
  apiReportAnonymousPost,
  apiVoteAnonymousPost,
} from '../utils/api';
import { ANONYMOUS_TOPICS } from '../utils/discovery';
import { TranslateControl } from './TranslateControl';

interface AnonymousViewProps {
  currentUser: UserProfile;
  posts: AnonymousPost[];
  initialTopic?: AnonymousTopic | 'All';
  onRefresh: () => Promise<void>;
}

export const AnonymousView: React.FC<AnonymousViewProps> = ({
  currentUser,
  posts,
  initialTopic = 'All',
  onRefresh,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<AnonymousTopic | 'All'>(initialTopic);
  const [showCompose, setShowCompose] = useState(false);
  const [topic, setTopic] = useState<AnonymousTopic>('Advice & Mentorship');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      selectedTopic === 'All'
        ? posts
        : posts.filter((p) => p.topic === selectedTopic),
    [posts, selectedTopic]
  );

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiCreateAnonymousPost({
        authorId: currentUser.id,
        topic,
        title,
        content,
      });
      setTitle('');
      setContent('');
      setShowCompose(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish topic.');
    }
  };

  const handleReply = async (postId: string) => {
    const text = (replyDrafts[postId] || '').trim();
    if (!text) return;
    setError(null);
    try {
      await apiReplyAnonymousPost(postId, currentUser.id, text);
      setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reply.');
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono-code font-semibold text-[var(--sp-accent-text)] uppercase flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Anonymous Safe Topics</span>
            </div>
            <h1 className="font-display text-xl font-extrabold text-[var(--sp-ink)] mt-0.5">
              Constructive Dialogue Under Deterministic Aliases
            </h1>
            <p className="text-xs text-[var(--sp-muted)] mt-0.5">
              Share experiences, ask for mentorship, or raise community concerns safely. Community guidelines still apply.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCompose((v) => !v)}
            className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Start Safe Topic</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(['All', ...ANONYMOUS_TOPICS] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTopic(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                selectedTopic === t
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] hover:text-[var(--sp-ink)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {showCompose && (
        <form
          onSubmit={handlePublish}
          className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as AnonymousTopic)}
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              {ANONYMOUS_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Topic headline..."
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>
          <textarea
            rows={3}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write thoughtfully (your real name stays hidden behind a generated alias)..."
            className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCompose(false)}
              className="px-3 py-1.5 rounded-lg border border-[var(--sp-border)] text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold cursor-pointer"
            >
              Post Anonymously
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {filtered.map((post) => {
          const voted = post.supportiveVotes.includes(currentUser.id);
          return (
            <article
              key={post.id}
              className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--sp-muted)]">
                <div>
                  <span className="font-mono-code font-bold text-[var(--sp-primary-text)]">
                    {post.alias}
                  </span>
                  <span> · {post.topic} · {post.createdAt}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiReportAnonymousPost(post.id, currentUser.id, 'Community moderation flag');
                    await onRefresh();
                  }}
                  className="inline-flex items-center gap-1 hover:text-red-500 cursor-pointer"
                >
                  <Flag className="w-3 h-3" />
                  <span>Flag ({post.reports.length})</span>
                </button>
              </div>

              <h2 className="font-display text-base font-bold text-[var(--sp-ink)]">{post.title}</h2>
              <p className="text-sm text-[var(--sp-ink-2)] leading-relaxed">{post.content}</p>

              <TranslateControl
                text={post.content}
                preferredLanguage={currentUser.preferredLanguage || 'English'}
                sourceLanguageHint={post.language}
                autoTranslate={currentUser.autoTranslate}
              />

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await apiVoteAnonymousPost(post.id, currentUser.id);
                    await onRefresh();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    voted
                      ? 'bg-[var(--sp-accent-soft)] text-[var(--sp-accent-text)] border border-[var(--sp-accent-soft-border)]'
                      : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                  }`}
                >
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>Support ({post.supportiveVotes.length})</span>
                </button>
                <span className="text-xs text-[var(--sp-muted)] inline-flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {post.replies.length} replies
                </span>
              </div>

              {post.replies.length > 0 && (
                <div className="pt-3 border-t border-[var(--sp-border-subtle)] space-y-2">
                  {post.replies.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg bg-[var(--sp-surface-alt)] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[var(--sp-muted)]">
                        <strong className="font-mono-code text-[var(--sp-accent-text)]">{r.alias}</strong>
                        <span>{r.createdAt}</span>
                      </div>
                      <p className="text-[var(--sp-ink)]">{r.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={replyDrafts[post.id] || ''}
                  onChange={(e) =>
                    setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                  }
                  placeholder="Write a supportive reply under an alias..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <button
                  type="button"
                  onClick={() => void handleReply(post.id)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
                >
                  Reply
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
