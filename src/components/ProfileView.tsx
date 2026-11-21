import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Cake,
  Calendar,
  Camera,
  Check,
  Edit3,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Lock,
  MapPin,
  MessageCircle,
  Music,
  Send,
  Shield,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Utensils,
} from 'lucide-react';
import {
  AlbumItem,
  GroupItem,
  MarketplaceItem,
  NavRoute,
  PageItem,
  PhotoItem,
  PrivacyLevel,
  SocialPost,
  TestimonialItem,
  UserProfile,
} from '../types/social';
import { apiAddTestimonial, apiCreatePost, apiFetchUserActivity, apiToggleFriend } from '../utils/api';
import {
  canPostOnWall,
  canViewProfile,
  getEffectiveSphereId,
  getPrivacyFrameworkForCountry,
} from '../utils/discovery';
import { AlbumsPanel } from './AlbumsPanel';
import { FeedPostCard } from './FeedPostCard';
import { useImageViewer } from './ImageViewerContext';
import { ImageWithFallback, UserAvatar } from './Media';
import { SphereIdBadge } from './SphereIdBadge';

interface ProfileViewProps {
  profileUser: UserProfile;
  currentUser: UserProfile;
  users: UserProfile[];
  posts: SocialPost[];
  photos: PhotoItem[];
  albums: AlbumItem[];
  pages: PageItem[];
  groups: GroupItem[];
  marketplace: MarketplaceItem[];
  testimonials: TestimonialItem[];
  onlineUserIds: string[];
  initialTab?: 'timeline' | 'about' | 'friends' | 'photos' | 'testimonials';
  onRefresh: () => Promise<void>;
  onNavigate: (route: NavRoute) => void;
  onOpenPhoto: (photoId: string) => void;
  onSharePost: (post: SocialPost) => void;
  onOpenLive: (post: SocialPost) => void;
  onMessageUser: (userId: string) => void;
  onBoostPost: (postId: string) => void;
  onOpenSphereId: () => void;
  onOpenEditProfile: () => void;
  onOpenPhotoManager: (mode: 'avatar' | 'cover') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profileUser,
  currentUser,
  users,
  posts,
  photos,
  albums,
  pages,
  groups,
  marketplace,
  testimonials,
  onlineUserIds,
  initialTab = 'timeline',
  onRefresh,
  onNavigate,
  onOpenPhoto,
  onSharePost,
  onOpenLive,
  onMessageUser,
  onBoostPost,
  onOpenSphereId,
  onOpenEditProfile,
  onOpenPhotoManager,
}) => {
  const { openImage } = useImageViewer();
  const [tab, setTab] = useState<'timeline' | 'about' | 'friends' | 'photos' | 'testimonials'>(
    initialTab
  );
  const [wallText, setWallText] = useState('');
  const [wallPrivacy, setWallPrivacy] = useState<PrivacyLevel>('friends_only');
  const [wallMessage, setWallMessage] = useState<string | null>(null);
  const [wallError, setWallError] = useState<string | null>(null);
  const [postingWall, setPostingWall] = useState(false);

  const [testimonialQuote, setTestimonialQuote] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendsLimit, setFriendsLimit] = useState(24);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityOverlay, setActivityOverlay] = useState<{
    userId: string;
    user?: UserProfile;
    posts: SocialPost[];
    photos: PhotoItem[];
    albums: AlbumItem[];
    testimonials: TestimonialItem[];
  } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [profileUser.id, initialTab]);

  useEffect(() => {
    setFriendSearch('');
    setFriendsLimit(24);
    setWallMessage(null);
    setWallError(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [profileUser.id]);

  useEffect(() => {
    let cancelled = false;
    setLoadingActivity(true);
    void apiFetchUserActivity(profileUser.id, currentUser.id)
      .then((res) => {
        if (cancelled) return;
        setActivityOverlay({
          userId: profileUser.id,
          user: res.user,
          posts: res.posts,
          photos: res.photos,
          albums: res.albums,
          testimonials: res.testimonials,
        });
        const existingPostIds = new Set(posts.map((p) => p.id));
        const existingPhotoIds = new Set(photos.map((ph) => ph.id));
        const hasNewItems =
          res.posts.some((p) => !existingPostIds.has(p.id)) ||
          res.photos.some((ph) => !existingPhotoIds.has(ph.id));
        if (hasNewItems) {
          void onRefresh();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingActivity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileUser.id, currentUser.id]);

  const resolvedUser =
    activityOverlay?.userId === profileUser.id && activityOverlay.user
      ? { ...profileUser, ...activityOverlay.user }
      : profileUser;

  const isOwnProfile = resolvedUser.id === currentUser.id;
  const profileVisible = canViewProfile(currentUser.id, resolvedUser, users);
  const wallCheck = canPostOnWall(currentUser.id, resolvedUser, users);
  const privacyFramework = getPrivacyFrameworkForCountry(resolvedUser.country);

  const mergedPosts = useMemo(() => {
    if (activityOverlay?.userId !== resolvedUser.id) return posts;
    const map = new Map<string, SocialPost>();
    for (const p of activityOverlay.posts) map.set(p.id, p);
    for (const p of posts) map.set(p.id, p);
    return Array.from(map.values());
  }, [posts, activityOverlay, resolvedUser.id]);

  const mergedPhotos = useMemo(() => {
    if (activityOverlay?.userId !== resolvedUser.id) return photos;
    const map = new Map<string, PhotoItem>();
    for (const ph of activityOverlay.photos) map.set(ph.id, ph);
    for (const ph of photos) map.set(ph.id, ph);
    return Array.from(map.values());
  }, [photos, activityOverlay, resolvedUser.id]);

  const mergedAlbums = useMemo(() => {
    if (activityOverlay?.userId !== resolvedUser.id) return albums;
    const map = new Map<string, AlbumItem>();
    for (const a of activityOverlay.albums) map.set(a.id, a);
    for (const a of albums) map.set(a.id, a);
    return Array.from(map.values());
  }, [albums, activityOverlay, resolvedUser.id]);

  const mergedTestimonials = useMemo(() => {
    if (activityOverlay?.userId !== resolvedUser.id) return testimonials;
    const map = new Map<string, TestimonialItem>();
    for (const t of activityOverlay.testimonials) map.set(t.id, t);
    for (const t of testimonials) map.set(t.id, t);
    return Array.from(map.values());
  }, [testimonials, activityOverlay, resolvedUser.id]);

  const profilePosts = useMemo(
    () =>
      mergedPosts.filter((p) => {
        const isAuthorOnOwnWall = p.authorId === resolvedUser.id && !p.targetProfileId && !p.postAsPage;
        const isWallPost = p.targetProfileId === resolvedUser.id && p.wallApproved !== false;
        const isApprovedTag = (p.approvedTagUserIds || []).includes(resolvedUser.id);
        return isAuthorOnOwnWall || isWallPost || isApprovedTag;
      }),
    [mergedPosts, resolvedUser.id]
  );

  const profilePhotos = useMemo(
    () => mergedPhotos.filter((ph) => ph.ownerId === resolvedUser.id && !ph.postAsPage),
    [mergedPhotos, resolvedUser.id]
  );

  const profileFriends = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    return users
      .filter((u) => {
        if (u.id === resolvedUser.id) return false;
        if (isOwnProfile) return u.friendship === 'friends';
        if (u.id === currentUser.id && resolvedUser.friendship === 'friends') return true;
        return u.friendship === 'friends' || u.mutualFriends > 0;
      })
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.location.toLowerCase().includes(q) ||
          (u.occupation || '').toLowerCase().includes(q)
      );
  }, [users, resolvedUser.id, resolvedUser.friendship, isOwnProfile, currentUser.id, friendSearch]);

  const receivedTestimonials = useMemo(
    () => mergedTestimonials.filter((t) => t.recipientId === resolvedUser.id),
    [mergedTestimonials, resolvedUser.id]
  );

  const handleWallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallText.trim()) return;
    setWallError(null);
    setWallMessage(null);
    setPostingWall(true);
    try {
      const res = await apiCreatePost({
        authorId: currentUser.id,
        targetProfileId: isOwnProfile ? undefined : profileUser.id,
        content: wallText.trim(),
        location: currentUser.location,
        country: currentUser.country || 'Philippines',
        privacy: wallPrivacy,
      });
      setWallText('');
      if (res.message) setWallMessage(res.message);
      await onRefresh();
    } catch (err) {
      setWallError(err instanceof Error ? err.message : 'Unable to post on MySpace.');
    } finally {
      setPostingWall(false);
    }
  };

  if (!profileVisible) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--sp-primary-soft)] flex items-center justify-center">
            <Lock className="w-6 h-6 text-[var(--sp-primary-text)]" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[var(--sp-ink)]">
            {profileUser.name}&apos;s MySpace is Protected
          </h1>
          <p className="text-sm text-[var(--sp-muted)] max-w-md mx-auto">
            This member restricts profile visibility to{' '}
            <strong className="text-[var(--sp-ink)]">
              {profileUser.privacy.replace(/_/g, ' ')}
            </strong>{' '}
            under {privacyFramework.shortCode} privacy controls.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            {profileUser.friendship === 'none' && (
              <button
                type="button"
                onClick={async () => {
                  await apiToggleFriend(profileUser.id, currentUser.id, 'toggle');
                  await onRefresh();
                }}
                className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Send Friend Request</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate({ page: 'home' })}
              className="px-4 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold cursor-pointer"
            >
              Back to Pulse
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-10 space-y-5">
      {/* Cover + Overlapping MyIcon Header Card */}
      <div className="bg-[var(--sp-surface)] border-x border-b border-[var(--sp-border)] rounded-b-2xl overflow-hidden shadow-xs">
        <div className="relative h-52 sm:h-68 bg-slate-900">
          {profileUser.coverImage ? (
            <ImageWithFallback
              src={profileUser.coverImage}
              alt={`${profileUser.name} cover`}
              lightboxTitle={`${profileUser.name} · Cover Photo`}
              lightboxSubtitle={`@${profileUser.handle} · ${profileUser.location}`}
              onClick={() =>
                openImage({
                  src: profileUser.coverImage!,
                  title: `${profileUser.name} · Cover Photo`,
                  subtitle: `@${profileUser.handle} · ${profileUser.location}`,
                  badge: 'Cover Photo',
                  actionLabel: isOwnProfile ? 'Update Cover Photo' : undefined,
                  onAction: isOwnProfile ? () => onOpenPhotoManager('cover') : undefined,
                })
              }
              className="w-full h-full object-cover cursor-zoom-in"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#4F46E5] to-[#06B6D4]" />
          )}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => onOpenPhotoManager('cover')}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-950 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Edit Cover</span>
            </button>
          )}
        </div>

        <div className="px-5 sm:px-8 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="relative inline-block">
                <div
                  onClick={() => {
                    if (profileUser.avatar) {
                      openImage({
                        src: profileUser.avatar,
                        title: `${profileUser.name} · Profile Photo`,
                        subtitle: `@${profileUser.handle} · ${profileUser.location}`,
                        badge: 'Profile Picture',
                        actionLabel: isOwnProfile ? 'Update Profile Photo' : undefined,
                        onAction: isOwnProfile ? () => onOpenPhotoManager('avatar') : undefined,
                      });
                    } else if (isOwnProfile) {
                      onOpenPhotoManager('avatar');
                    }
                  }}
                  title={profileUser.avatar ? 'View profile photo' : undefined}
                  className={profileUser.avatar ? 'cursor-zoom-in rounded-full' : undefined}
                >
                  <UserAvatar
                    user={profileUser}
                    size="2xl"
                    isOnline={onlineUserIds.includes(profileUser.id)}
                    className="ring-4 ring-[var(--sp-surface)]"
                  />
                </div>
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => onOpenPhotoManager('avatar')}
                    title="Manage MyIcon"
                    className="absolute bottom-1 right-1 p-2 rounded-full bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white shadow-md cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="pb-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                    {resolvedUser.name}
                  </h1>
                  <SphereIdBadge
                    category={getEffectiveSphereId(resolvedUser)}
                    onOpenSphereId={onOpenSphereId}
                  />
                </div>
                <div className="text-xs text-[var(--sp-muted)] flex flex-wrap items-center gap-2">
                  <span>@{resolvedUser.handle.replace(/^@+/, '')}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {resolvedUser.location}
                  </span>
                  {!resolvedUser.popularitySettings?.hideFollowerCounts && (
                    <>
                      <span>·</span>
                      <span className="tabular-nums font-semibold text-[var(--sp-ink-2)]">
                        {resolvedUser.friendCount.toLocaleString()} friends
                      </span>
                    </>
                  )}
                  {resolvedUser.activeStatusLabel && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {resolvedUser.activeStatusLabel}
                      </span>
                    </>
                  )}
                </div>
                {resolvedUser.status && (
                  <p className="text-xs text-[var(--sp-ink-2)] pt-0.5 max-w-xl">
                    “{resolvedUser.status}”
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={onOpenEditProfile}
                    className="px-4 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-xs font-semibold text-[var(--sp-ink)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'privacy' })}
                    className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Privacy &amp; Tagging</span>
                  </button>
                </>
              ) : (
                <>
                  {profileUser.friendship === 'friends' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiToggleFriend(profileUser.id, currentUser.id, 'toggle');
                        await onRefresh();
                      }}
                      className="px-4 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Friends</span>
                    </button>
                  ) : profileUser.friendship === 'requested_incoming' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiToggleFriend(profileUser.id, currentUser.id, 'accept');
                        await onRefresh();
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Request</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiToggleFriend(profileUser.id, currentUser.id, 'toggle');
                        await onRefresh();
                      }}
                      className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {profileUser.friendship === 'requested_outgoing' ? (
                        <UserMinus className="w-3.5 h-3.5" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {profileUser.friendship === 'requested_outgoing' ? 'Requested' : 'Connect'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onMessageUser(profileUser.id)}
                    className="px-4 py-2 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 mt-5 pt-3 border-t border-[var(--sp-border-subtle)] text-xs font-bold">
            {(
              [
                { id: 'timeline', label: 'MySpace Posts' },
                { id: 'about', label: 'About & Privacy' },
                { id: 'friends', label: 'Friends' },
                { id: 'photos', label: 'Images & Frames' },
                { id: 'testimonials', label: `Testimonials (${receivedTestimonials.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  tab === t.id
                    ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)]'
                    : 'text-[var(--sp-muted)] hover:bg-[var(--sp-surface-alt)] hover:text-[var(--sp-ink)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB CONTENT */}
      {tab === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Intro Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3 text-xs">
              <h2 className="font-display text-base font-extrabold text-[var(--sp-ink)]">Intro</h2>
              <p className="text-[var(--sp-ink-2)] leading-relaxed">{resolvedUser.bio}</p>
              <blockquote className="p-2.5 rounded-lg bg-[var(--sp-surface-alt)] italic text-[var(--sp-ink-2)]">
                “{resolvedUser.quote}”
              </blockquote>
              <div className="space-y-2 text-[var(--sp-ink-2)] pt-1">
                {(resolvedUser.occupation || resolvedUser.workplace) && (
                  <div className="flex items-start gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-[var(--sp-primary-text)] mt-0.5 shrink-0" />
                    <span>
                      <strong>{resolvedUser.occupation}</strong>
                      {resolvedUser.workplace ? ` at ${resolvedUser.workplace}` : ''}
                    </span>
                  </div>
                )}
                {resolvedUser.education && (
                  <div className="flex items-start gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-[var(--sp-accent-text)] mt-0.5 shrink-0" />
                    <span>Studied at {resolvedUser.education}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Home className="w-3.5 h-3.5 text-[var(--sp-muted)] mt-0.5 shrink-0" />
                  <span>
                    Lives in <strong>{resolvedUser.location}</strong>
                    {resolvedUser.hometown && resolvedUser.hometown !== resolvedUser.location
                      ? ` · From ${resolvedUser.hometown}`
                      : ''}
                  </span>
                </div>
                {resolvedUser.relationshipStatus && (
                  <div className="flex items-start gap-2">
                    <Heart className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                    <span>{resolvedUser.relationshipStatus}</span>
                  </div>
                )}
                {resolvedUser.currentlyInto && (
                  <div className="flex items-start gap-2">
                    <Music className="w-3.5 h-3.5 text-[#06B6D4] mt-0.5 shrink-0" />
                    <span>{resolvedUser.currentlyInto}</span>
                  </div>
                )}
                {resolvedUser.favoriteFood && (
                  <div className="flex items-start gap-2">
                    <Utensils className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>Go-to comfort: {resolvedUser.favoriteFood}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[var(--sp-muted)]">
                  <Globe className="w-3.5 h-3.5 text-[var(--sp-accent-text)] shrink-0" />
                  <span>Speaks {resolvedUser.language || 'English'}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--sp-muted)]">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Joined {resolvedUser.joinedDate}
                    {resolvedUser.birthday ? ` · Birthday: ${resolvedUser.birthday}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[var(--sp-muted)]">
                  <Shield className="w-3.5 h-3.5 text-[var(--sp-primary-text)] shrink-0" />
                  <span>
                    {privacyFramework.shortCode} · Visibility:{' '}
                    {resolvedUser.privacy.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-[var(--sp-border-subtle)] text-[var(--sp-ink-2)]">
                <span className="font-semibold text-[var(--sp-ink)]">Interests: </span>
                {resolvedUser.interests.join(' · ')}
              </div>
            </div>

            {/* Photos Quick Grid */}
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-extrabold text-[var(--sp-ink)]">
                  Images ({profilePhotos.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('photos')}
                  className="text-xs font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                >
                  Open Frames
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {profilePhotos.slice(0, 6).map((ph) => (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => onOpenPhoto(ph.id)}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer"
                  >
                    <ImageWithFallback
                      src={ph.src}
                      alt={ph.caption}
                      className="w-full h-full object-cover hover:opacity-90"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Friends Quick Preview Grid */}
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-extrabold text-[var(--sp-ink)]">
                  Friends ({profileFriends.length.toLocaleString()})
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('friends')}
                  className="text-xs font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                >
                  See all
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {profileFriends.slice(0, 6).map((pf) => (
                  <button
                    key={pf.id}
                    type="button"
                    onClick={() => onNavigate({ page: 'profile', userId: pf.id, tab: 'timeline' })}
                    className="text-left group cursor-pointer space-y-1"
                  >
                    <div className="flex justify-center p-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] group-hover:border-[var(--sp-primary)]">
                      <UserAvatar user={pf} size="md" isOnline={onlineUserIds.includes(pf.id)} />
                    </div>
                    <div className="text-[11px] font-bold text-[var(--sp-ink)] group-hover:text-[var(--sp-primary-text)] truncate text-center">
                      {pf.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Wall Composer & Timeline */}
          <div className="lg:col-span-7 space-y-4">
            {wallCheck.allowed ? (
              <form
                onSubmit={handleWallSubmit}
                className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--sp-ink)]">
                    {isOwnProfile
                      ? 'Post to your MySpace'
                      : `Write on ${profileUser.name}'s MySpace`}
                  </span>
                  {wallCheck.requiresApproval && !isOwnProfile && (
                    <span className="text-[11px] text-[var(--sp-primary-text)] font-medium">
                      Approval required before appearing
                    </span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={wallText}
                  onChange={(e) => setWallText(e.target.value)}
                  placeholder={
                    isOwnProfile
                      ? 'Share a moment or update...'
                      : `Leave a note on ${profileUser.name.split(' ')[0]}'s MySpace...`
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                {wallError && <div className="text-xs text-red-500">{wallError}</div>}
                {wallMessage && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    {wallMessage}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={wallPrivacy}
                    onChange={(e) => setWallPrivacy(e.target.value as PrivacyLevel)}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    <option value="public">Everyone</option>
                    <option value="friends_of_friends">Friends of Friends</option>
                    <option value="friends_only">Friends Only</option>
                    <option value="only_me">Only Me</option>
                  </select>
                  <button
                    type="submit"
                    disabled={postingWall || !wallText.trim()}
                    className="px-4 py-1.5 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-40"
                  >
                    {postingWall ? 'Sending...' : 'Post to MySpace'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 text-xs text-[var(--sp-muted)] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[var(--sp-primary-text)] shrink-0" />
                <span>{wallCheck.reason}</span>
              </div>
            )}

            {profilePosts.length === 0 ? (
              <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-8 text-center text-xs text-[var(--sp-muted)]">
                {loadingActivity ? 'Loading life updates & timeline...' : 'No visible MySpace posts yet.'}
              </div>
            ) : (
              profilePosts.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  users={users}
                  posts={mergedPosts}
                  photos={mergedPhotos}
                  pages={pages}
                  groups={groups}
                  marketplace={marketplace}
                  onlineUserIds={onlineUserIds}
                  onRefresh={onRefresh}
                  onNavigate={onNavigate}
                  onOpenPhoto={onOpenPhoto}
                  onSharePost={onSharePost}
                  onOpenLive={onOpenLive}
                  onBoostPost={onBoostPost}
                  onOpenSphereId={onOpenSphereId}
                />
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'about' && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-6 space-y-5 text-sm">
          <div>
            <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
              Life Details, Work &amp; Discovery Signals
            </h2>
            <p className="text-xs text-[var(--sp-ink-2)] mt-1">{resolvedUser.bio}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] space-y-2">
              <div className="font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[var(--sp-primary-text)]" />
                <span>Career &amp; Education</span>
              </div>
              <div className="text-[var(--sp-ink-2)] space-y-1">
                <div>
                  <strong>Role:</strong> {resolvedUser.occupation || 'Community Creator'}
                </div>
                {resolvedUser.workplace && (
                  <div>
                    <strong>Workplace:</strong> {resolvedUser.workplace}
                  </div>
                )}
                {resolvedUser.education && (
                  <div>
                    <strong>Education:</strong> {resolvedUser.education}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] space-y-2">
              <div className="font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-[#06B6D4]" />
                <span>Roots, Status &amp; Daily Life</span>
              </div>
              <div className="text-[var(--sp-ink-2)] space-y-1">
                <div>
                  <strong>Current City:</strong> {resolvedUser.location}
                </div>
                {resolvedUser.hometown && (
                  <div>
                    <strong>Hometown:</strong> {resolvedUser.hometown}
                  </div>
                )}
                {resolvedUser.relationshipStatus && (
                  <div>
                    <strong>Relationship:</strong> {resolvedUser.relationshipStatus}
                  </div>
                )}
                {resolvedUser.birthday && (
                  <div>
                    <strong>Birthday:</strong> {resolvedUser.birthday}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] space-y-1.5">
              <div className="font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Interests, Hobbies &amp; Favorites</span>
              </div>
              <div className="text-[var(--sp-ink-2)]">
                {[...resolvedUser.interests, ...(resolvedUser.hobbies || [])].join(' · ')}
              </div>
              {resolvedUser.currentlyInto && (
                <div className="text-[var(--sp-muted)] pt-1">
                  <strong>Currently into:</strong> {resolvedUser.currentlyInto}
                </div>
              )}
              {resolvedUser.favoriteFood && (
                <div className="text-[var(--sp-muted)]">
                  <strong>Favorite food:</strong> {resolvedUser.favoriteFood}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] space-y-1.5">
              <div className="font-bold text-[var(--sp-ink)]">Skills &amp; Personal Goals</div>
              <div className="text-[var(--sp-ink-2)]">
                {[...(resolvedUser.skills || []), ...(resolvedUser.goals || [])].join(' · ') || 'Community collaboration'}
              </div>
              <div className="text-[var(--sp-muted)] pt-1">
                <strong>Languages:</strong> {resolvedUser.language || 'English'} ·{' '}
                <strong>Joined:</strong> {resolvedUser.joinedDate}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] space-y-1 text-xs">
            <div className="font-bold text-[var(--sp-primary-text)]">
              Applicable Regional Privacy Framework: {privacyFramework.lawName}
            </div>
            <p className="text-[var(--sp-ink-2)]">{privacyFramework.summary}</p>
          </div>
        </div>
      )}

      {tab === 'friends' && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)] flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--sp-primary-text)]" />
              <span>Circle Friends ({profileFriends.length.toLocaleString()})</span>
            </h2>
            <input
              type="text"
              value={friendSearch}
              onChange={(e) => {
                setFriendSearch(e.target.value);
                setFriendsLimit(24);
              }}
              placeholder="Search friends by name or location..."
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] w-full sm:w-64"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profileFriends.slice(0, friendsLimit).map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'profile', userId: f.id, tab: 'timeline' })}
                  className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                >
                  <UserAvatar user={f} size="md" isOnline={onlineUserIds.includes(f.id)} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--sp-ink)] truncate">{f.name}</div>
                    <div className="text-[11px] text-[var(--sp-muted)] truncate">{f.location}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onMessageUser(f.id)}
                  className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-primary-text)] cursor-pointer shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {profileFriends.length > friendsLimit && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-[var(--sp-border-subtle)]">
              <span className="text-xs text-[var(--sp-muted)]">
                Showing {Math.min(friendsLimit, profileFriends.length).toLocaleString()} of{' '}
                {profileFriends.length.toLocaleString()} friends
              </span>
              <button
                type="button"
                onClick={() => setFriendsLimit((prev) => prev + 36)}
                className="px-4 py-1.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold cursor-pointer"
              >
                Show More Friends
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'photos' && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5">
          <AlbumsPanel
            ownerId={resolvedUser.id}
            currentUser={currentUser}
            albums={mergedAlbums}
            photos={mergedPhotos}
            onRefresh={onRefresh}
            onOpenPhoto={onOpenPhoto}
          />
        </div>
      )}

      {tab === 'testimonials' && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-4">
          <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
            Testimonials for {profileUser.name.split(' ')[0]}
          </h2>

          {!isOwnProfile && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!testimonialQuote.trim()) return;
                await apiAddTestimonial({
                  authorId: currentUser.id,
                  recipientId: profileUser.id,
                  quote: testimonialQuote.trim(),
                });
                setTestimonialQuote('');
                await onRefresh();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={testimonialQuote}
                onChange={(e) => setTestimonialQuote(e.target.value)}
                placeholder={`Write a warm testimonial for ${profileUser.name.split(' ')[0]}...`}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          )}

          <div className="space-y-3">
            {receivedTestimonials.map((t) => {
              const author = users.find((u) => u.id === t.authorId);
              return (
                <div
                  key={t.id}
                  className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        author && onNavigate({ page: 'profile', userId: author.id, tab: 'timeline' })
                      }
                      className="flex items-center gap-2 font-bold text-[var(--sp-ink)] hover:underline cursor-pointer"
                    >
                      <UserAvatar user={author} size="xs" />
                      <span>{author?.name}</span>
                    </button>
                    <span className="text-[11px] text-[var(--sp-muted)]">{t.createdAt}</span>
                  </div>
                  <p className="text-sm text-[var(--sp-ink-2)] italic">“{t.quote}”</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
