import React, { useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Cake,
  Compass,
  Disc3,
  Film,
  Gamepad2,
  Globe,
  Hash,
  HeartHandshake,
  Image as ImageIcon,
  Layers,
  Lock,
  Megaphone,
  MessageCircle,
  Moon,
  Orbit,
  Radio,
  Search,
  Send,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Tag,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  AdCampaign,
  AlbumItem,
  GroupItem,
  LocationScope,
  MarketplaceItem,
  NavRoute,
  PageItem,
  PhotoItem,
  PostVibe,
  PrivacyLevel,
  SocialPost,
  UserProfile,
  VideoFormat,
} from '../types/social';
import { apiCreatePost, apiToggleFriend, apiUploadFile } from '../utils/api';
import {
  LOCATION_SCOPE_OPTIONS,
  canTagUser,
  getBirthdaySuggestions,
  matchesLocationScope,
} from '../utils/discovery';
import { FeedPostCard } from './FeedPostCard';
import { ImageWithFallback, UserAvatar } from './Media';
import { OrbitMap } from './OrbitMap';

interface FeedViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  posts: SocialPost[];
  photos: PhotoItem[];
  albums: AlbumItem[];
  pages: PageItem[];
  groups: GroupItem[];
  marketplace: MarketplaceItem[];
  adCampaigns: AdCampaign[];
  onlineUserIds: string[];
  activeHashtag?: string;
  activeLocation?: string;
  initialViewMode?: 'pulse' | 'orbit';
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefresh: () => Promise<void>;
  onNavigate: (route: NavRoute) => void;
  onOpenPhoto: (photoId: string) => void;
  onSharePost: (post: SocialPost) => void;
  onOpenLive: (post?: SocialPost) => void;
  onMessageUser: (userId: string) => void;
  onBoostPost: (postId: string) => void;
  onOpenSphereId: () => void;
  onOpenGuidelines: () => void;
}

type OrbitLens = 'all' | 'friends' | 'mutuals' | 'public' | 'only_me';

const ECHO_KINDS: PostVibe['kind'][] = ['Listening', 'At', 'Creating', 'Reading', 'Throwback'];

export const FeedView: React.FC<FeedViewProps> = ({
  currentUser,
  users,
  posts,
  photos,
  albums,
  pages,
  groups,
  marketplace,
  adCampaigns,
  onlineUserIds,
  activeHashtag,
  activeLocation,
  initialViewMode = 'pulse',
  theme,
  onToggleTheme,
  onRefresh,
  onNavigate,
  onOpenPhoto,
  onSharePost,
  onOpenLive,
  onMessageUser,
  onBoostPost,
  onOpenSphereId,
  onOpenGuidelines,
}) => {
  const [viewMode, setViewMode] = useState<'pulse' | 'orbit'>(initialViewMode);
  const [scope, setScope] = useState<LocationScope>(currentUser.preferredScope || 'global');
  const [orbitLens, setOrbitLens] = useState<OrbitLens>('all');
  const [contactFilter, setContactFilter] = useState('');

  // Composer state
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('public');
  const [vibeKind, setVibeKind] = useState<PostVibe['kind'] | ''>('');
  const [vibeLabel, setVibeLabel] = useState('');
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string>('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [videoData, setVideoData] = useState<{
    src: string;
    format: VideoFormat;
    durationSeconds: number;
    durationLabel: string;
    title: string;
  } | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Selected Tale preview
  const [activeTaleUserId, setActiveTaleUserId] = useState<string | null>(null);

  // Birthday custom greeting drafts
  const [bdayDrafts, setBdayDrafts] = useState<Record<string, string>>({});
  const [bdaySent, setBdaySent] = useState<Record<string, string>>({});

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const myAlbums = useMemo(
    () => albums.filter((a) => a.ownerId === currentUser.id),
    [albums, currentUser.id]
  );

  const friends = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && u.friendship === 'friends'),
    [users, currentUser.id]
  );

  const incomingRequests = useMemo(
    () => users.filter((u) => u.friendship === 'requested_incoming'),
    [users]
  );

  const pendingApprovals = useMemo(() => {
    const tagCount = posts.filter((p) => (p.pendingTagUserIds || []).includes(currentUser.id)).length;
    const wallCount = posts.filter(
      (p) => p.targetProfileId === currentUser.id && p.wallApproved === false
    ).length;
    return { tagCount, wallCount, total: tagCount + wallCount };
  }, [posts, currentUser.id]);

  const birthdaySuggestions = useMemo(
    () => getBirthdaySuggestions(currentUser, users),
    [currentUser, users]
  );

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      const matches = post.content.match(/#[A-Za-z0-9_]+/g) || [];
      for (const tag of matches) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [posts]);

  const activeLivePosts = useMemo(
    () => posts.filter((p) => p.liveStream?.isLive),
    [posts]
  );

  const talesUsers = useMemo(
    () =>
      [currentUser, ...friends].filter((u) => u.status).slice(0, 8),
    [currentUser, friends]
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (activeHashtag && !p.content.toLowerCase().includes(activeHashtag.toLowerCase())) {
        return false;
      }
      if (
        activeLocation &&
        !(p.location || '').toLowerCase().includes(activeLocation.toLowerCase())
      ) {
        return false;
      }
      const author = users.find((u) => u.id === p.authorId);
      if (!matchesLocationScope(p, author, currentUser, scope)) {
        return false;
      }
      if (orbitLens === 'friends') {
        return p.authorId === currentUser.id || author?.friendship === 'friends';
      }
      if (orbitLens === 'mutuals') {
        return (
          p.authorId === currentUser.id ||
          author?.friendship === 'friends' ||
          (author?.mutualFriends || 0) > 0
        );
      }
      if (orbitLens === 'public') {
        return (p.privacy || 'public') === 'public';
      }
      if (orbitLens === 'only_me') {
        return p.authorId === currentUser.id && p.privacy === 'only_me';
      }
      return true;
    });
  }, [posts, users, currentUser, scope, orbitLens, activeHashtag, activeLocation]);

  // Pick at most 1 approved campaign matching viewer
  const sponsoredCampaign = useMemo(() => {
    return adCampaigns.find((c) => {
      if (c.status !== 'approved') return false;
      const targetLocMatch =
        c.targetLocations.length === 0 ||
        c.targetLocations.some((loc) =>
          currentUser.location.toLowerCase().includes(loc.toLowerCase())
        );
      const targetCountryMatch =
        c.targetCountries.length === 0 ||
        c.targetCountries.some(
          (ct) => (currentUser.country || 'Philippines').toLowerCase() === ct.toLowerCase()
        );
      return targetLocMatch || targetCountryMatch;
    });
  }, [adCampaigns, currentUser]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerError(null);
    setUploadingMedia(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const uploaded = await apiUploadFile({
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });
      setUploadedPhotoUrl(uploaded.url);
      setVideoData(null);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>, desiredFormat: VideoFormat) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerError(null);
    setUploadingMedia(true);
    try {
      // Client-side Loop 3-minute (180s) duration validation via HTML5 <video> metadata
      const durationSeconds = await new Promise<number>((resolve) => {
        const tempUrl = URL.createObjectURL(file);
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        videoEl.onloadedmetadata = () => {
          const dur = Number.isFinite(videoEl.duration) ? Math.round(videoEl.duration) : 30;
          URL.revokeObjectURL(tempUrl);
          resolve(dur);
        };
        videoEl.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          resolve(30);
        };
        videoEl.src = tempUrl;
      });

      if (desiredFormat === 'short' && durationSeconds > 180) {
        setComposerError(
          `Loops are limited to 3 minutes (180 seconds) max. Your clip is ${Math.floor(
            durationSeconds / 60
          )}m ${durationSeconds % 60}s — upload it as a 16:9 Video instead.`
        );
        return;
      }

      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read video file'));
        reader.readAsDataURL(file);
      });

      const uploaded = await apiUploadFile({
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });

      const mins = Math.floor(durationSeconds / 60);
      const secs = String(durationSeconds % 60).padStart(2, '0');
      setVideoData({
        src: uploaded.url,
        format: desiredFormat,
        durationSeconds,
        durationLabel: `${mins}:${secs}`,
        title: file.name.replace(/\.[^.]+$/, ''),
      });
      setUploadedPhotoUrl('');
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !uploadedPhotoUrl && !videoData) {
      setComposerError('Write an update or attach an image, Loop, or Video.');
      return;
    }
    setComposerError(null);
    setComposerNotice(null);
    setPublishing(true);
    try {
      const res = await apiCreatePost({
        authorId: currentUser.id,
        content: content.trim(),
        location: currentUser.location,
        country: currentUser.country || 'Philippines',
        privacy,
        vibe: vibeKind && vibeLabel.trim() ? { kind: vibeKind, label: vibeLabel.trim() } : undefined,
        taggedUserIds: taggedIds,
        photoSrc: uploadedPhotoUrl || undefined,
        albumId: selectedAlbumId || undefined,
        video: videoData || undefined,
      });
      setContent('');
      setVibeKind('');
      setVibeLabel('');
      setUploadedPhotoUrl('');
      setVideoData(null);
      setTaggedIds([]);
      setShowTagPicker(false);
      if (res.message) setComposerNotice(res.message);
      await onRefresh();
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Unable to publish post.');
    } finally {
      setPublishing(false);
    }
  };

  const handleSendBirthdayGreeting = async (targetUser: UserProfile) => {
    const text =
      bdayDrafts[targetUser.id]?.trim() ||
      `Happy Birthday, ${targetUser.name.split(' ')[0]}! Wishing you joy, health, and wonderful moments ahead on Sphere.`;
    try {
      const res = await apiCreatePost({
        authorId: currentUser.id,
        targetProfileId: targetUser.id,
        content: text,
        location: currentUser.location,
        country: currentUser.country || 'Philippines',
        privacy: 'friends_only',
      });
      setBdaySent((prev) => ({
        ...prev,
        [targetUser.id]: res.message || `Greeting shared to ${targetUser.name}'s MySpace!`,
      }));
      await onRefresh();
    } catch (err) {
      setBdaySent((prev) => ({
        ...prev,
        [targetUser.id]: err instanceof Error ? err.message : 'Could not send greeting.',
      }));
    }
  };

  const filteredContacts = useMemo(() => {
    const q = contactFilter.trim().toLowerCase();
    return friends.filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [friends, contactFilter]);

  const activeTaleUser = activeTaleUserId
    ? users.find((u) => u.id === activeTaleUserId)
    : undefined;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT RAIL */}
      <aside className="hidden lg:block lg:col-span-3 space-y-4">
        <div className="sticky top-20 space-y-4 max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-1">
          {/* MySpace Profile Shortcut */}
          <button
            type="button"
            onClick={() => onNavigate({ page: 'profile', userId: currentUser.id, tab: 'timeline' })}
            className="w-full p-3 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] flex items-center gap-3 text-left cursor-pointer transition-colors"
          >
            <UserAvatar user={currentUser} size="md" isOnline />
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--sp-ink)] truncate">{currentUser.name}</div>
              <div className="text-[11px] text-[var(--sp-muted)] truncate">
                MySpace · {currentUser.location}
              </div>
            </div>
          </button>

          {/* Primary Shortcuts */}
          <nav className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-2 space-y-0.5 text-xs font-medium">
            {[
              {
                label: 'Pulse Feed',
                icon: Globe,
                active: viewMode === 'pulse',
                onClick: () => setViewMode('pulse'),
              },
              {
                label: 'My Orbit Map',
                icon: Orbit,
                active: viewMode === 'orbit',
                onClick: () => setViewMode('orbit'),
              },
              {
                label: 'Global Circle',
                icon: Compass,
                onClick: () => onNavigate({ page: 'global', tab: 'circle' }),
              },
              {
                label: 'Find Your People',
                icon: Users,
                onClick: () => onNavigate({ page: 'global', tab: 'find-people' }),
              },
              {
                label: 'Pages',
                icon: Bookmark,
                onClick: () => onNavigate({ page: 'discover', tab: 'pages' }),
              },
              {
                label: 'Circles (Groups)',
                icon: Layers,
                onClick: () => onNavigate({ page: 'discover', tab: 'groups' }),
              },
              {
                label: 'Loops & Videos',
                icon: Film,
                onClick: () => onNavigate({ page: 'discover', tab: 'videos' }),
              },
              {
                label: 'On Live',
                icon: Radio,
                onClick: () => onNavigate({ page: 'discover', tab: 'live' }),
              },
              {
                label: 'Images & Frames',
                icon: ImageIcon,
                onClick: () => onNavigate({ page: 'discover', tab: 'photos' }),
              },
              {
                label: 'Shelves Marketplace',
                icon: ShoppingBag,
                onClick: () => onNavigate({ page: 'marketplace' }),
              },
              {
                label: 'Gaming Hub',
                icon: Gamepad2,
                onClick: () => onNavigate({ page: 'discover', tab: 'gaming' }),
              },
              {
                label: 'Aid Drives',
                icon: HeartHandshake,
                onClick: () => onNavigate({ page: 'donations' }),
              },
              {
                label: 'Safe Topics (Anonymous)',
                icon: Shield,
                onClick: () => onNavigate({ page: 'anonymous' }),
              },
              {
                label: 'Privacy & Tagging',
                icon: Lock,
                onClick: () => onNavigate({ page: 'privacy' }),
              },
              {
                label: 'Ads Manager',
                icon: Megaphone,
                onClick: () => onNavigate({ page: 'ads' }),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left cursor-pointer transition-colors ${
                  item.active
                    ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] font-bold'
                    : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}

            <div className="pt-2 mt-2 border-t border-[var(--sp-border-subtle)] space-y-1">
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-[var(--sp-primary-text)] font-bold hover:bg-[var(--sp-primary-soft)] cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Sphere Policy Guidelines</span>
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)] cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </button>
            </div>
          </nav>

          {/* Followed Pages Shortcut */}
          <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-mono-code font-bold text-[var(--sp-muted)] uppercase">
              Followed Pages
            </div>
            {pages.slice(0, 4).map((pg) => (
              <button
                key={pg.id}
                type="button"
                onClick={() => onNavigate({ page: 'discover', tab: 'pages', pageId: pg.id })}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-[var(--sp-border)]">
                  <ImageWithFallback
                    src={pg.avatar || pg.coverImage}
                    alt={pg.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs font-semibold text-[var(--sp-ink)] truncate">{pg.name}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* CENTER STREAM */}
      <main className="lg:col-span-6 space-y-4">
        {/* Pulse / My Orbit Toggle & Active Filter Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setViewMode('pulse')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                viewMode === 'pulse'
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)]'
              }`}
            >
              Pulse Feed
            </button>
            <button
              type="button"
              onClick={() => setViewMode('orbit')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'orbit'
                  ? 'bg-[#06B6D4] text-slate-950'
                  : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)]'
              }`}
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>My Orbit Map</span>
            </button>
          </div>

          {(activeHashtag || activeLocation) && (
            <button
              type="button"
              onClick={() => onNavigate({ page: 'home' })}
              className="px-2.5 py-1 rounded-lg bg-[var(--sp-accent-soft)] text-[var(--sp-accent-text)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Filter: {activeHashtag || activeLocation}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {viewMode === 'orbit' ? (
          <OrbitMap
            currentUser={currentUser}
            users={users}
            pages={pages}
            groups={groups}
            onlineUserIds={onlineUserIds}
            onNavigate={onNavigate}
            onMessageUser={onMessageUser}
          />
        ) : (
          <>
            {/* Tales & On Live Strip */}
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-bold text-[var(--sp-ink)]">
                  Tales &amp; On Live
                </span>
                <button
                  type="button"
                  onClick={() => onOpenLive()}
                  className="text-rose-600 dark:text-rose-400 font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Go On Live</span>
                </button>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {activeLivePosts.map((lp) => {
                  const host = users.find((u) => u.id === lp.authorId);
                  return (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => onOpenLive(lp)}
                      className="w-28 shrink-0 rounded-xl bg-slate-900 text-white p-2.5 text-left border border-rose-500/60 hover:border-rose-400 cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <UserAvatar user={host} size="sm" isOnline />
                        <span className="text-[9px] font-mono-code font-bold text-rose-400">
                          ON LIVE
                        </span>
                      </div>
                      <div className="text-[11px] font-bold truncate">{host?.name.split(' ')[0]}</div>
                      <div className="text-[10px] text-slate-300 truncate">{lp.liveStream?.title}</div>
                    </button>
                  );
                })}

                {talesUsers.map((tu) => (
                  <button
                    key={tu.id}
                    type="button"
                    onClick={() => setActiveTaleUserId(tu.id)}
                    className="w-28 shrink-0 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] p-2.5 text-left cursor-pointer space-y-2"
                  >
                    <UserAvatar user={tu} size="sm" isOnline={onlineUserIds.includes(tu.id)} />
                    <div className="text-[11px] font-bold text-[var(--sp-ink)] truncate">
                      {tu.id === currentUser.id ? 'Your Tale' : tu.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-[var(--sp-muted)] line-clamp-2">{tu.status}</div>
                  </button>
                ))}
              </div>

              {activeTaleUser && (
                <div className="p-3 rounded-xl bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] flex items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ page: 'profile', userId: activeTaleUser.id, tab: 'timeline' })
                    }
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:opacity-85"
                  >
                    <UserAvatar user={activeTaleUser} size="sm" />
                    <div className="min-w-0">
                      <div className="font-bold text-[var(--sp-ink)] hover:underline">
                        {activeTaleUser.name}&apos;s Tale · {activeTaleUser.location}
                      </div>
                      <div className="text-[var(--sp-ink-2)] truncate">“{activeTaleUser.status}”</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTaleUserId(null)}
                    className="p-1 rounded text-[var(--sp-muted)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Birthday Greeting Suggestions Banner */}
            {birthdaySuggestions.length > 0 && (
              <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cake className="w-4 h-4 text-[#06B6D4]" />
                    <h2 className="font-display text-sm font-bold text-[var(--sp-ink)]">
                      Circle Birthday Greetings
                    </h2>
                  </div>
                  <span className="text-[11px] text-[var(--sp-muted)]">
                    Celebrate your friends directly on MySpace
                  </span>
                </div>
                {birthdaySuggestions.slice(0, 2).map((bday) => (
                  <div
                    key={bday.user.id}
                    className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ page: 'profile', userId: bday.user.id, tab: 'timeline' })
                        }
                        className="flex items-center gap-2 text-left cursor-pointer hover:underline"
                      >
                        <UserAvatar user={bday.user} size="sm" />
                        <div>
                          <div className="text-xs font-bold text-[var(--sp-ink)]">{bday.user.name}</div>
                          <div className="text-[11px] text-[var(--sp-primary-text)] font-semibold">
                            {bday.label}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ page: 'profile', userId: bday.user.id, tab: 'timeline' })
                        }
                        className="text-[11px] text-[var(--sp-muted)] hover:underline cursor-pointer"
                      >
                        Visit MySpace
                      </button>
                    </div>
                    {bdaySent[bday.user.id] ? (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {bdaySent[bday.user.id]}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={
                            bdayDrafts[bday.user.id] ??
                            `Happy Birthday, ${bday.user.name.split(' ')[0]}! Wishing you happiness and success!`
                          }
                          onChange={(e) =>
                            setBdayDrafts((prev) => ({ ...prev, [bday.user.id]: e.target.value }))
                          }
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSendBirthdayGreeting(bday.user)}
                          className="px-3 py-1.5 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Post Composer */}
            <form
              onSubmit={handlePublishPost}
              className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <UserAvatar user={currentUser} size="md" isOnline />
                <div className="flex-1 space-y-2">
                  <textarea
                    rows={2}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={`Share with your Sphere, ${currentUser.name.split(' ')[0]}...`}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--sp-primary)]/30"
                  />

                  {/* Echoes / Vibe Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Echoes activity kind"
                      value={vibeKind}
                      onChange={(e) => setVibeKind(e.target.value as PostVibe['kind'] | '')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)]"
                    >
                      <option value="">+ Echoes / Vibe</option>
                      {ECHO_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    {vibeKind && (
                      <input
                        type="text"
                        value={vibeLabel}
                        onChange={(e) => setVibeLabel(e.target.value)}
                        placeholder={`What are you ${vibeKind.toLowerCase()}?`}
                        className="flex-1 min-w-[160px] px-2.5 py-1 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Media Previews */}
              {uploadedPhotoUrl && (
                <div className="p-2.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--sp-ink)]">Attached Image</span>
                    <button
                      type="button"
                      onClick={() => setUploadedPhotoUrl('')}
                      className="text-red-500 text-xs font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <img
                    src={uploadedPhotoUrl}
                    alt="Upload preview"
                    className="max-h-52 rounded-lg object-cover"
                  />
                  {myAlbums.length > 0 && (
                    <select
                      value={selectedAlbumId}
                      onChange={(e) => setSelectedAlbumId(e.target.value)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                    >
                      <option value="">Save to Frame: Unfiled</option>
                      {myAlbums.map((a) => (
                        <option key={a.id} value={a.id}>
                          Save to Frame: {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {videoData && (
                <div className="p-2.5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-[var(--sp-ink)]">
                      {videoData.format === 'short' ? 'Loop (9:16)' : 'Video (16:9)'} ·{' '}
                      {videoData.title}
                    </div>
                    <div className="text-[11px] text-[var(--sp-muted)]">
                      Duration: {videoData.durationLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVideoData(null)}
                    className="text-red-500 font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Tag Friends Picker */}
              {showTagPicker && (
                <div className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-2 text-xs">
                  <div className="font-bold text-[var(--sp-ink)]">Tag Friends in Your Circle</div>
                  <div className="flex flex-wrap gap-1.5">
                    {friends.map((f) => {
                      const check = canTagUser(currentUser.id, f, users);
                      const selected = taggedIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          disabled={!check.allowed}
                          onClick={() =>
                            setTaggedIds((prev) =>
                              prev.includes(f.id)
                                ? prev.filter((id) => id !== f.id)
                                : [...prev, f.id]
                            )
                          }
                          title={!check.allowed ? check.reason : check.requiresApproval ? 'Tag approval enabled' : 'Direct tag'}
                          className={`px-2.5 py-1 rounded-lg border font-medium cursor-pointer disabled:opacity-40 ${
                            selected
                              ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)]'
                              : 'bg-[var(--sp-surface)] border-[var(--sp-border)] text-[var(--sp-ink)]'
                          }`}
                        >
                          {f.name.split(' ')[0]}
                          {check.requiresApproval ? ' (review)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {composerError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
                  {composerError}
                </div>
              )}
              {composerNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
                  {composerNotice}
                </div>
              )}

              {/* Action Toolbar */}
              <div className="pt-2 border-t border-[var(--sp-border-subtle)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Image</span>
                  </button>

                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => {
                      const fmt = (e.target.dataset.format as VideoFormat) || 'short';
                      void handleVideoSelect(e, fmt);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (videoInputRef.current) {
                        videoInputRef.current.dataset.format = 'short';
                        videoInputRef.current.click();
                      }
                    }}
                    disabled={uploadingMedia}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Loop ≤3m</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (videoInputRef.current) {
                        videoInputRef.current.dataset.format = 'long';
                        videoInputRef.current.click();
                      }
                    }}
                    disabled={uploadingMedia}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
                    <span>Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTagPicker((v) => !v)}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                    <span>Tag{taggedIds.length > 0 ? ` (${taggedIds.length})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenLive()}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-rose-600 dark:text-rose-400 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>On Live</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <select
                    aria-label="Post audience privacy"
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] font-semibold"
                  >
                    <option value="public">Everyone</option>
                    <option value="friends_of_friends">Friends of Friends</option>
                    <option value="friends_only">Friends Only</option>
                    <option value="only_me">Only Me</option>
                  </select>
                  <button
                    type="submit"
                    disabled={publishing || uploadingMedia}
                    className="px-4 py-1.5 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {uploadingMedia ? 'Uploading...' : publishing ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </form>

            {/* Location Scope & Orbit Lens Filters */}
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-mono-code text-[var(--sp-muted)] mr-1">
                    Scope:
                  </span>
                  {LOCATION_SCOPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScope(opt.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        scope === opt.id
                          ? 'bg-[var(--sp-primary)] text-white'
                          : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] hover:text-[var(--sp-ink)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-mono-code text-[var(--sp-muted)] mr-1">
                    Lens:
                  </span>
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'friends', label: 'Friends' },
                      { id: 'mutuals', label: 'Mutuals' },
                      { id: 'public', label: 'Public' },
                      { id: 'only_me', label: 'Only Me' },
                    ] as const
                  ).map((lens) => (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => setOrbitLens(lens.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        orbitLens === lens.id
                          ? 'bg-[#06B6D4] text-slate-950 font-bold'
                          : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                      }`}
                    >
                      {lens.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Feed Stream */}
            {filteredPosts.length === 0 ? (
              <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-8 text-center space-y-2">
                <p className="text-sm font-bold text-[var(--sp-ink)]">
                  No posts match this scope or Orbit Lens yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setScope('global');
                    setOrbitLens('all');
                    onNavigate({ page: 'home' });
                  }}
                  className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
                >
                  Reset Feed Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post, idx) => {
                  const showAdHere =
                    sponsoredCampaign &&
                    sponsoredCampaign.postId === post.id &&
                    idx <= 4;
                  return (
                    <FeedPostCard
                      key={post.id}
                      post={post}
                      sponsoredCampaign={showAdHere ? sponsoredCampaign : undefined}
                      currentUser={currentUser}
                      users={users}
                      posts={posts}
                      photos={photos}
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
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* RIGHT RAIL */}
      <aside className="hidden lg:block lg:col-span-3 space-y-4">
        <div className="sticky top-20 space-y-4 max-h-[calc(100vh-5.5rem)] overflow-y-auto pl-1">
          {/* Pending Tag / Wall Approval Alert */}
          {pendingApprovals.total > 0 && (
            <div className="p-3.5 rounded-xl bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] space-y-2">
              <div className="text-xs font-bold text-[var(--sp-primary-text)] flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>{pendingApprovals.total} Approval Request(s)</span>
              </div>
              <p className="text-[11px] text-[var(--sp-ink-2)]">
                Review pending profile tags or MySpace wall shares before they appear publicly.
              </p>
              <button
                type="button"
                onClick={() => onNavigate({ page: 'privacy' })}
                className="w-full py-1.5 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
              >
                Review in Privacy Controls
              </button>
            </div>
          )}

          {/* Friend Requests */}
          {incomingRequests.length > 0 && (
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center justify-between">
                <span>Circle Requests</span>
                <span className="font-mono-code text-[var(--sp-primary-text)]">
                  {incomingRequests.length}
                </span>
              </div>
              {incomingRequests.map((reqUser) => (
                <div key={reqUser.id} className="space-y-2 pt-1 border-t border-[var(--sp-border-subtle)]">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ page: 'profile', userId: reqUser.id, tab: 'timeline' })
                    }
                    className="flex items-center gap-2 text-left cursor-pointer"
                  >
                    <UserAvatar user={reqUser} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--sp-ink)] truncate">
                        {reqUser.name}
                      </div>
                      <div className="text-[10px] text-[var(--sp-muted)] truncate">
                        {reqUser.location}
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiToggleFriend(reqUser.id, currentUser.id, 'accept');
                        await onRefresh();
                      }}
                      className="flex-1 py-1 rounded-md bg-[var(--sp-primary)] text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiToggleFriend(reqUser.id, currentUser.id, 'decline');
                        await onRefresh();
                      }}
                      className="flex-1 py-1 rounded-md bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[11px] font-semibold cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Birthdays Sidebar Summary */}
          {birthdaySuggestions.length > 0 && (
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3.5 space-y-2">
              <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-[#06B6D4]" />
                <span>Upcoming Birthdays</span>
              </div>
              {birthdaySuggestions.slice(0, 3).map((b) => (
                <button
                  key={b.user.id}
                  type="button"
                  onClick={() =>
                    onNavigate({ page: 'profile', userId: b.user.id, tab: 'timeline' })
                  }
                  className="w-full flex items-center justify-between text-xs py-1 hover:underline text-left cursor-pointer"
                >
                  <span className="font-semibold text-[var(--sp-ink)] truncate">
                    {b.user.name}
                  </span>
                  <span className="text-[11px] text-[var(--sp-accent-text)] shrink-0">
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Live Contacts Dock Trigger */}
          <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--sp-ink)]">Contacts</span>
              <span className="text-[10px] font-mono-code text-emerald-500">
                {onlineUserIds.filter((id) => id !== currentUser.id).length} online
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--sp-muted)] absolute left-2.5 top-2" />
              <input
                type="text"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
                placeholder="Filter contacts..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredContacts.slice(0, 60).map((f) => (
                <div
                  key={f.id}
                  className="w-full flex items-center justify-between gap-1.5 p-1 rounded-lg hover:bg-[var(--sp-surface-alt)]"
                >
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'profile', userId: f.id, tab: 'timeline' })}
                    title={`Visit ${f.name}'s account`}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <UserAvatar
                      user={f}
                      size="xs"
                      isOnline={onlineUserIds.includes(f.id)}
                    />
                    <span className="text-xs font-medium text-[var(--sp-ink)] group-hover:text-[var(--sp-primary-text)] group-hover:underline truncate">
                      {f.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMessageUser(f.id)}
                    title={`Message ${f.name}`}
                    className="p-1.5 rounded-md hover:bg-[var(--sp-surface)] text-[var(--sp-muted)] hover:text-[var(--sp-primary-text)] cursor-pointer shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Hashtags */}
          <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3.5 space-y-2">
            <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
              <span>Trending Across Sphere.</span>
            </div>
            <div className="space-y-1">
              {trendingTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onNavigate({ page: 'home', hashtag: tag })}
                  className="w-full flex items-center justify-between py-1 text-xs hover:text-[var(--sp-primary-text)] cursor-pointer"
                >
                  <span className="font-semibold text-[var(--sp-ink-2)]">{tag}</span>
                  <span className="text-[11px] font-mono-code text-[var(--sp-muted)] tabular-nums">
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
