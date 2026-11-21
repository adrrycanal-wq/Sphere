import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Disc3,
  Globe,
  Lock,
  MapPin,
  Megaphone,
  MessageSquare,
  PenLine,
  Radio,
  Share2,
  ShoppingBag,
  Trash2,
  Users,
} from 'lucide-react';
import {
  AdCampaign,
  GroupItem,
  MarketplaceItem,
  NavRoute,
  PageItem,
  PhotoItem,
  PrivacyLevel,
  ReactionType,
  SocialPost,
  UserProfile,
} from '../types/social';
import {
  apiAddPostComment,
  apiDeletePost,
  apiReactComment,
  apiReactPost,
  apiTrackAd,
  apiUpdatePostAudience,
} from '../utils/api';
import { getEffectiveSphereId } from '../utils/discovery';
import { ImageWithFallback, UserAvatar } from './Media';
import { ReactionControls } from './ReactionControls';
import { SphereIdBadge } from './SphereIdBadge';
import { TranslateControl } from './TranslateControl';
import { VideoPlayer } from './VideoPlayer';

interface FeedPostCardProps {
  post: SocialPost;
  sponsoredCampaign?: AdCampaign;
  currentUser: UserProfile;
  users: UserProfile[];
  posts: SocialPost[];
  photos: PhotoItem[];
  pages: PageItem[];
  groups: GroupItem[];
  marketplace: MarketplaceItem[];
  onlineUserIds: string[];
  onRefresh: () => Promise<void>;
  onNavigate: (route: NavRoute) => void;
  onOpenPhoto: (photoId: string) => void;
  onSharePost: (post: SocialPost) => void;
  onOpenLive: (post: SocialPost) => void;
  onBoostPost: (postId: string) => void;
  onOpenSphereId: () => void;
}

export const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  sponsoredCampaign,
  currentUser,
  users,
  posts,
  photos,
  pages,
  groups,
  marketplace,
  onlineUserIds,
  onRefresh,
  onNavigate,
  onOpenPhoto,
  onSharePost,
  onOpenLive,
  onBoostPost,
  onOpenSphereId,
}) => {
  const [commentsOpen, setCommentsOpen] = useState(post.comments.length > 0);
  const [commentInput, setCommentInput] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);

  const author = users.find((u) => u.id === post.authorId);
  const targetPage = post.pageId ? pages.find((p) => p.id === post.pageId) : undefined;
  const targetGroup = post.groupId ? groups.find((g) => g.id === post.groupId) : undefined;
  const targetWallUser = post.targetProfileId
    ? users.find((u) => u.id === post.targetProfileId)
    : undefined;
  const attachedPhoto = post.photoId ? photos.find((ph) => ph.id === post.photoId) : undefined;
  const linkedProduct = post.marketplaceItemId
    ? marketplace.find((m) => m.id === post.marketplaceItemId)
    : undefined;
  const sharedOriginal = post.sharedPostId
    ? posts.find((p) => p.id === post.sharedPostId)
    : undefined;

  const isAuthor = post.authorId === currentUser.id;
  const hideCounts = Boolean(currentUser.popularitySettings?.hidePublicLikeCounts);
  const showAsPage = Boolean(post.postAsPage && targetPage);

  useEffect(() => {
    if (sponsoredCampaign) {
      void apiTrackAd(sponsoredCampaign.id, currentUser.id, 'impression').catch(() => {});
    }
  }, [sponsoredCampaign?.id]);

  const handlePostReact = async (type: ReactionType) => {
    await apiReactPost(post.id, currentUser.id, type);
    if (sponsoredCampaign) {
      void apiTrackAd(sponsoredCampaign.id, currentUser.id, 'engagement').catch(() => {});
    }
    await onRefresh();
  };

  const handleCommentReact = async (commentId: string, type: ReactionType) => {
    await apiReactComment(post.id, commentId, currentUser.id, type);
    await onRefresh();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || commentBusy) return;
    setCommentError(null);
    setCommentBusy(true);
    try {
      await apiAddPostComment(post.id, currentUser.id, commentInput.trim());
      setCommentInput('');
      setCommentsOpen(true);
      await onRefresh();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setCommentBusy(false);
    }
  };

  const renderContentWithTokens = (text: string) => {
    const tokens = text.split(/(#[A-Za-z0-9_]+)/g);
    return tokens.map((part, idx) =>
      part.startsWith('#') ? (
        <button
          key={idx}
          type="button"
          onClick={() => onNavigate({ page: 'home', hashtag: part })}
          className="text-[var(--sp-accent-text)] font-semibold hover:underline cursor-pointer"
        >
          {part}
        </button>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  const approvedTags = (post.approvedTagUserIds || [])
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is UserProfile => Boolean(u));

  return (
    <article className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl overflow-hidden shadow-xs">
      {sponsoredCampaign && (
        <div className="px-4 py-1.5 bg-[var(--sp-primary-soft)] border-b border-[var(--sp-primary-soft-border)] flex items-center justify-between text-[11px] font-mono-code font-semibold text-[var(--sp-primary-text)]">
          <span>Sponsored · Promoted Post</span>
          {sponsoredCampaign.destinationUrl && (
            <a
              href={sponsoredCampaign.destinationUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => void apiTrackAd(sponsoredCampaign.id, currentUser.id, 'click')}
              className="underline hover:opacity-80"
            >
              Visit Link →
            </a>
          )}
        </div>
      )}

      {/* Header */}
      <div className="p-4 pb-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {showAsPage && targetPage ? (
            <button
              type="button"
              onClick={() =>
                onNavigate({ page: 'discover', tab: 'pages', pageId: targetPage.id })
              }
              className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--sp-border)] shrink-0 cursor-pointer"
            >
              <ImageWithFallback
                src={targetPage.avatar || targetPage.coverImage}
                alt={targetPage.name}
                className="w-full h-full object-cover"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                author && onNavigate({ page: 'profile', userId: author.id, tab: 'timeline' })
              }
              className="shrink-0 cursor-pointer"
            >
              <UserAvatar
                user={author}
                size="md"
                isOnline={author ? onlineUserIds.includes(author.id) : false}
              />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {showAsPage && targetPage ? (
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({ page: 'discover', tab: 'pages', pageId: targetPage.id })
                  }
                  className="font-display font-bold text-[var(--sp-ink)] hover:text-[var(--sp-primary-text)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{targetPage.name}</span>
                  {targetPage.verified && (
                    <BadgeCheck className="w-4 h-4 text-[var(--sp-primary-text)]" />
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      author &&
                      onNavigate({ page: 'profile', userId: author.id, tab: 'timeline' })
                    }
                    className="font-display font-bold text-[var(--sp-ink)] hover:text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                  >
                    {author?.name || 'Sphere Member'}
                  </button>
                  {author && (
                    <SphereIdBadge
                      category={getEffectiveSphereId(author)}
                      onOpenSphereId={onOpenSphereId}
                    />
                  )}
                </>
              )}

              {targetWallUser && targetWallUser.id !== post.authorId && (
                <span className="text-xs text-[var(--sp-muted)]">
                  →{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ page: 'profile', userId: targetWallUser.id, tab: 'timeline' })
                    }
                    className="font-semibold text-[var(--sp-ink)] hover:underline cursor-pointer"
                  >
                    {targetWallUser.name}&apos;s MySpace
                  </button>
                </span>
              )}

              {!showAsPage && targetPage && (
                <span className="text-xs text-[var(--sp-muted)]">
                  posted on{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ page: 'discover', tab: 'pages', pageId: targetPage.id })
                    }
                    className="font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                  >
                    {targetPage.name}
                  </button>
                </span>
              )}

              {targetGroup && (
                <span className="text-xs text-[var(--sp-muted)]">
                  in{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ page: 'discover', tab: 'groups', groupId: targetGroup.id })
                    }
                    className="font-semibold text-[var(--sp-accent-text)] hover:underline cursor-pointer"
                  >
                    {targetGroup.name}
                  </button>
                </span>
              )}

              {approvedTags.length > 0 && (
                <span className="text-xs text-[var(--sp-muted)]">
                  with{' '}
                  {approvedTags.map((tu, idx) => (
                    <React.Fragment key={tu.id}>
                      {idx > 0 && ', '}
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ page: 'profile', userId: tu.id, tab: 'timeline' })
                        }
                        className="font-semibold text-[var(--sp-ink)] hover:underline cursor-pointer"
                      >
                        {tu.name}
                      </button>
                    </React.Fragment>
                  ))}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--sp-muted)] mt-0.5">
              <span>{post.createdAt}</span>
              {post.location && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'home', location: post.location })}
                    className="inline-flex items-center gap-0.5 hover:text-[var(--sp-ink)] cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>{post.location}</span>
                  </button>
                </>
              )}
              <span>·</span>
              {isAuthor ? (
                <select
                  aria-label="Change post privacy"
                  value={post.privacy || 'public'}
                  onChange={async (e) => {
                    await apiUpdatePostAudience(
                      post.id,
                      currentUser.id,
                      e.target.value as PrivacyLevel
                    );
                    await onRefresh();
                  }}
                  className="bg-transparent text-[11px] font-semibold text-[var(--sp-primary-text)] cursor-pointer focus:outline-none"
                >
                  <option value="public">Everyone</option>
                  <option value="friends_of_friends">Friends of Friends</option>
                  <option value="friends_only">Friends Only</option>
                  <option value="only_me">Only Me (Vault)</option>
                </select>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {post.privacy === 'only_me' ? (
                    <Lock className="w-3 h-3" />
                  ) : post.privacy === 'friends_only' ? (
                    <Users className="w-3 h-3" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  <span>{(post.privacy || 'public').replace(/_/g, ' ')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isAuthor && !sponsoredCampaign && (
            <button
              type="button"
              onClick={() => onBoostPost(post.id)}
              title="Boost this post"
              className="px-2.5 py-1 rounded-lg bg-[var(--sp-surface-alt)] hover:bg-[var(--sp-primary-soft)] text-[11px] font-semibold text-[var(--sp-primary-text)] inline-flex items-center gap-1 cursor-pointer"
            >
              <Megaphone className="w-3 h-3" />
              <span className="hidden sm:inline">Boost</span>
            </button>
          )}
          {(isAuthor || post.targetProfileId === currentUser.id) && (
            <button
              type="button"
              onClick={async () => {
                await apiDeletePost(post.id, currentUser.id);
                await onRefresh();
              }}
              title="Delete post"
              className="p-1.5 rounded-lg text-[var(--sp-muted)] hover:text-red-500 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Echoes / Vibe Metadata */}
      {post.vibe && (
        <div className="px-4 pb-1.5 flex items-center gap-1.5 text-xs text-[var(--sp-accent-text)] font-medium">
          {post.vibe.kind === 'Listening' ? (
            <Disc3 className="w-3.5 h-3.5" />
          ) : (
            <PenLine className="w-3.5 h-3.5" />
          )}
          <span>
            {post.vibe.kind}: <strong>{post.vibe.label}</strong>
          </span>
        </div>
      )}

      {/* Post Body */}
      {post.content && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-sm text-[var(--sp-ink)] leading-relaxed whitespace-pre-line">
            {renderContentWithTokens(post.content)}
          </p>
          <TranslateControl
            text={post.content}
            preferredLanguage={currentUser.preferredLanguage || 'English'}
            sourceLanguageHint={post.language}
            autoTranslate={currentUser.autoTranslate}
          />
        </div>
      )}

      {/* Photo Attachment (Flush) */}
      {attachedPhoto && (
        <button
          type="button"
          onClick={() => onOpenPhoto(attachedPhoto.id)}
          className="block w-full max-h-[460px] overflow-hidden border-y border-[var(--sp-border-subtle)] cursor-pointer"
        >
          <ImageWithFallback
            src={attachedPhoto.src}
            alt={attachedPhoto.caption}
            className="w-full h-full max-h-[460px] object-cover hover:opacity-95 transition-opacity"
          />
        </button>
      )}

      {/* Loop or Video */}
      {post.video && (
        <div className="px-4 pb-3">
          <VideoPlayer video={post.video} />
        </div>
      )}

      {/* On Live Card */}
      {post.liveStream && (
        <div className="mx-4 mb-3 p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-mono-code font-bold text-[#22D3EE] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-500" />
              <span>
                {post.liveStream.isLive
                  ? `ON LIVE · ${post.liveStream.viewerCount} watching`
                  : `ON LIVE REPLAY · ${post.liveStream.durationLabel}`}
              </span>
            </div>
            <div className="font-display text-sm font-bold truncate mt-0.5">
              {post.liveStream.title}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenLive(post)}
            className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold shrink-0 cursor-pointer"
          >
            {post.liveStream.isLive ? 'Join Live' : 'Watch Replay'}
          </button>
        </div>
      )}

      {/* Linked Shelves Product Card */}
      {linkedProduct && (
        <div className="mx-4 mb-3 p-3.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-mono-code font-semibold text-[var(--sp-accent-text)] flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" />
              <span>Featured on Sphere. Shelves</span>
            </div>
            <div className="text-sm font-bold text-[var(--sp-ink)] truncate">
              {linkedProduct.title}
            </div>
            <div className="text-xs text-[var(--sp-primary-text)] font-mono-code font-bold tabular-nums">
              ₱{linkedProduct.price.toLocaleString()} · {linkedProduct.location}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onNavigate({ page: 'marketplace', listingId: linkedProduct.id })
            }
            className="px-3 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold shrink-0 cursor-pointer"
          >
            View on Shelves
          </button>
        </div>
      )}

      {/* Embedded Shared Post */}
      {post.sharedPostId && (
        <div className="mx-4 mb-3 p-3.5 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-alt)]">
          {sharedOriginal ? (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[var(--sp-ink)]">
                {users.find((u) => u.id === sharedOriginal.authorId)?.name || 'Sphere Member'}
                <span className="font-normal text-[var(--sp-muted)]"> · {sharedOriginal.createdAt}</span>
              </div>
              <p className="text-xs text-[var(--sp-ink-2)]">{sharedOriginal.content}</p>
            </div>
          ) : (
            <p className="text-xs text-[var(--sp-muted)] italic">
              This shared post is protected by the original author&apos;s privacy settings.
            </p>
          )}
        </div>
      )}

      {/* Action Row */}
      <div className="px-4 py-2.5 border-t border-[var(--sp-border-subtle)] flex flex-wrap items-center justify-between gap-2">
        <ReactionControls
          currentUserId={currentUser.id}
          reactions={post.reactions}
          tracker={post.reactionTracker}
          fallbackLikes={post.likes}
          hideCounts={hideCounts}
          onReact={handlePostReact}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Comment ({post.comments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onSharePost(post)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share {post.sharesCount > 0 ? `(${post.sharesCount})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Comments & Comment Reactions */}
      {commentsOpen && (
        <div className="px-4 py-3 bg-[var(--sp-surface-alt)] border-t border-[var(--sp-border-subtle)] space-y-2.5">
          {post.comments.map((c) => {
            const cAuthor = users.find((u) => u.id === c.authorId);
            return (
              <div key={c.id} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    cAuthor &&
                    onNavigate({ page: 'profile', userId: cAuthor.id, tab: 'timeline' })
                  }
                  className="shrink-0 cursor-pointer"
                >
                  <UserAvatar user={cAuthor} size="xs" />
                </button>
                <div className="flex-1 min-w-0 bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)] rounded-xl px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        cAuthor &&
                        onNavigate({ page: 'profile', userId: cAuthor.id, tab: 'timeline' })
                      }
                      className="font-bold text-[var(--sp-ink)] hover:underline cursor-pointer"
                    >
                      {cAuthor?.name}
                    </button>
                    <span className="text-[10px] text-[var(--sp-muted)]">{c.createdAt}</span>
                  </div>
                  <p className="text-xs text-[var(--sp-ink-2)]">{c.text}</p>
                  <TranslateControl
                    text={c.text}
                    preferredLanguage={currentUser.preferredLanguage || 'English'}
                    sourceLanguageHint={c.language}
                    autoTranslate={currentUser.autoTranslate}
                  />
                  <div className="pt-0.5">
                    <ReactionControls
                      currentUserId={currentUser.id}
                      reactions={c.reactions}
                      tracker={c.reactionTracker}
                      hideCounts={hideCounts}
                      compact
                      onReact={(type) => handleCommentReact(c.id, type)}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {commentError && <div className="text-[11px] text-red-500">{commentError}</div>}

          <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
            <UserAvatar user={currentUser} size="xs" />
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-3 py-1.5 text-xs rounded-full bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
            <button
              type="submit"
              disabled={commentBusy || !commentInput.trim()}
              className="px-3 py-1.5 rounded-full bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </article>
  );
};
