import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Film,
  Gamepad2,
  Hash,
  Image as ImageIcon,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  MessageCircle,
  Plus,
  Quote,
  Radio,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AlbumItem,
  GroupItem,
  MarketplaceItem,
  NavRoute,
  PageItem,
  PhotoItem,
  PrivacyLevel,
  ReactionType,
  SocialPost,
  TestimonialItem,
  UserProfile,
} from '../types/social';
import {
  apiCommentMarketplaceItem,
  apiCreateGroup,
  apiCreateMarketplaceItem,
  apiCreatePage,
  apiCreatePost,
  apiReactMarketplaceItem,
  apiToggleFriend,
  apiToggleGroupJoin,
  apiToggleMarketplaceSold,
  apiTogglePageFollow,
  apiUpdateGroupRules,
  apiUpdatePageRules,
  apiUploadFile,
} from '../utils/api';
import { getCategoryGuidelines, PAGE_AND_GROUP_CATEGORIES } from '../utils/communityRules';
import { getEffectiveSphereId } from '../utils/discovery';
import { AlbumsPanel } from './AlbumsPanel';
import { FeedPostCard } from './FeedPostCard';
import { useImageViewer } from './ImageViewerContext';
import { ImageWithFallback, UserAvatar } from './Media';
import { ReactionControls } from './ReactionControls';
import { SphereIdBadge } from './SphereIdBadge';
import { VideoPlayer } from './VideoPlayer';

export type DiscoverHubMode =
  | 'pages'
  | 'groups'
  | 'marketplace'
  | 'videos'
  | 'live'
  | 'photos'
  | 'friends'
  | 'gaming'
  | 'testimonials'
  | 'trending';

interface DiscoverHubViewProps {
  mode: DiscoverHubMode;
  selectedPageId?: string;
  selectedGroupId?: string;
  selectedListingId?: string;
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
  onRefresh: () => Promise<void>;
  onNavigate: (route: NavRoute) => void;
  onOpenPhoto: (photoId: string) => void;
  onSharePost: (post: SocialPost) => void;
  onOpenLive: (post?: SocialPost) => void;
  onMessageUser: (userId: string) => void;
  onBoostPost: (postId: string) => void;
  onOpenSphereId: () => void;
}

const LABO_TRIVIA = [
  {
    q: 'Which annual festival in Labo, Camarines Norte celebrates community spirit, craftsmanship, and local harvest?',
    options: ['Busig-On Festival', 'Sinulog Festival', 'Panagbenga Festival'],
    answer: 0,
  },
  {
    q: 'What is a short vertical video (max 3 minutes) called on Sphere.?',
    options: ['Frame', 'Loop', 'Echo'],
    answer: 1,
  },
  {
    q: 'Which organizations are authorized to start verified Aid Drives on Sphere.?',
    options: ['Any personal account', 'Verified Government-Registered Organizations', 'Anonymous aliases'],
    answer: 1,
  },
];

export const DiscoverHubView: React.FC<DiscoverHubViewProps> = ({
  mode,
  selectedPageId,
  selectedGroupId,
  selectedListingId,
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
  onRefresh,
  onNavigate,
  onOpenPhoto,
  onSharePost,
  onOpenLive,
  onMessageUser,
  onBoostPost,
  onOpenSphereId,
}) => {
  const { openImage } = useImageViewer();
  // Pages filter, creation & page rules/post
  const [pageSearch, setPageSearch] = useState('');
  const [pageCatFilter, setPageCatFilter] = useState('All');
  const [pageOwnerFilter, setPageOwnerFilter] = useState<'all' | 'mine'>('all');
  const [pageNum, setPageNum] = useState(1);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [pageName, setPageName] = useState('');
  const [pageHandle, setPageHandle] = useState('');
  const [pageCategory, setPageCategory] = useState('Computer Parts & Hardware');
  const [pageDesc, setPageDesc] = useState('');
  const [pageRulesText, setPageRulesText] = useState(() =>
    getCategoryGuidelines('Computer Parts & Hardware').rules.join('\n')
  );
  const [pagePolicyText, setPagePolicyText] = useState(
    () => getCategoryGuidelines('Computer Parts & Hardware').postingPolicy
  );
  const [pagePostText, setPagePostText] = useState('');
  const [editingPageRules, setEditingPageRules] = useState(false);
  const [editPageRulesInput, setEditPageRulesInput] = useState('');
  const [editPagePolicyInput, setEditPagePolicyInput] = useState('');
  const [rulesSavedNotice, setRulesSavedNotice] = useState<string | null>(null);

  // Circles creation & group rules/post
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupCategory, setGroupCategory] = useState('Community & Craft');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupPrivacy, setGroupPrivacy] = useState<'public' | 'private'>('public');
  const [groupRulesText, setGroupRulesText] = useState(() =>
    getCategoryGuidelines('Community & Craft', true).rules.join('\n')
  );
  const [groupPolicyText, setGroupPolicyText] = useState(
    () => getCategoryGuidelines('Community & Craft', true).postingPolicy
  );
  const [groupPostText, setGroupPostText] = useState('');
  const [editingGroupRules, setEditingGroupRules] = useState(false);
  const [editGroupRulesInput, setEditGroupRulesInput] = useState('');
  const [editGroupPolicyInput, setEditGroupPolicyInput] = useState('');

  // Marketplace (Shelves) state
  const [mktCategory, setMktCategory] = useState('All');
  const [mktSearch, setMktSearch] = useState('');
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [mktTitle, setMktTitle] = useState('');
  const [mktPrice, setMktPrice] = useState(250);
  const [mktCatInput, setMktCatInput] = useState('Food & Pastries');
  const [mktCond, setMktCond] = useState<MarketplaceItem['condition']>('Brand New');
  const [mktDesc, setMktDesc] = useState('');
  const [mktImageSrc, setMktImageSrc] = useState('');
  const [mktPrivacy, setMktPrivacy] = useState<PrivacyLevel>('public');
  const [mktAllowInteract, setMktAllowInteract] = useState(true);
  const [mktCrossPost, setMktCrossPost] = useState(true);
  const [mktCommentText, setMktCommentText] = useState('');
  const [mktCommentError, setMktCommentError] = useState<string | null>(null);

  // Videos / Loops filter
  const [videoFilter, setVideoFilter] = useState<'all' | 'short' | 'long'>('all');

  // Gaming interactive trivia state
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaPicked, setTriviaPicked] = useState<number | null>(null);

  // Orbit friends search & pagination
  const [orbitFriendSearch, setOrbitFriendSearch] = useState('');
  const [orbitFriendsLimit, setOrbitFriendsLimit] = useState(24);

  const selectedPage = selectedPageId ? pages.find((p) => p.id === selectedPageId) : undefined;
  const selectedGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) : undefined;
  const selectedListing = selectedListingId
    ? marketplace.find((m) => m.id === selectedListingId)
    : undefined;

  const hideCounts = Boolean(currentUser.popularitySettings?.hidePublicLikeCounts);

  useEffect(() => {
    setEditingPageRules(false);
    setRulesSavedNotice(null);
  }, [selectedPageId]);

  useEffect(() => {
    setEditingGroupRules(false);
    setRulesSavedNotice(null);
  }, [selectedGroupId]);

  const pageCategories = useMemo(
    () => ['All', ...Array.from(new Set(pages.map((p) => p.category)))],
    [pages]
  );

  const myPagesCount = useMemo(
    () => pages.filter((p) => p.ownerId === currentUser.id).length,
    [pages, currentUser.id]
  );

  const filteredPages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    return pages.filter((pg) => {
      if (pageOwnerFilter === 'mine' && pg.ownerId !== currentUser.id) return false;
      if (pageCatFilter !== 'All' && pg.category !== pageCatFilter) return false;
      if (
        q &&
        !pg.name.toLowerCase().includes(q) &&
        !pg.handle.toLowerCase().includes(q) &&
        !pg.category.toLowerCase().includes(q) &&
        !pg.description.toLowerCase().includes(q) &&
        !pg.location.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [pages, pageSearch, pageCatFilter, pageOwnerFilter, currentUser.id]);

  const PAGES_PER_VIEW = 18;
  const totalPageViews = Math.max(1, Math.ceil(filteredPages.length / PAGES_PER_VIEW));
  const safePageNum = Math.min(pageNum, totalPageViews);
  const paginatedPages = useMemo(
    () =>
      filteredPages.slice(
        (safePageNum - 1) * PAGES_PER_VIEW,
        safePageNum * PAGES_PER_VIEW
      ),
    [filteredPages, safePageNum]
  );

  const videoPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.video &&
          (videoFilter === 'all' || p.video.format === videoFilter)
      ),
    [posts, videoFilter]
  );

  const livePosts = useMemo(
    () => posts.filter((p) => Boolean(p.liveStream)),
    [posts]
  );

  const filteredMarketplace = useMemo(() => {
    const q = mktSearch.trim().toLowerCase();
    return marketplace.filter(
      (item) =>
        (mktCategory === 'All' || item.category === mktCategory) &&
        (!q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q))
    );
  }, [marketplace, mktCategory, mktSearch]);

  const mktCategories = useMemo(
    () => ['All', ...Array.from(new Set(marketplace.map((m) => m.category)))],
    [marketplace]
  );

  const navTabs: { id: DiscoverHubMode; label: string; route: NavRoute }[] = [
    { id: 'pages', label: 'Pages', route: { page: 'discover', tab: 'pages' } },
    { id: 'groups', label: 'Circles', route: { page: 'discover', tab: 'groups' } },
    { id: 'marketplace', label: 'Shelves', route: { page: 'marketplace' } },
    { id: 'videos', label: 'Loops & Videos', route: { page: 'discover', tab: 'videos' } },
    { id: 'live', label: 'On Live', route: { page: 'discover', tab: 'live' } },
    { id: 'photos', label: 'Images & Frames', route: { page: 'discover', tab: 'photos' } },
    { id: 'friends', label: 'Orbit People', route: { page: 'friends' } },
    { id: 'gaming', label: 'Gaming', route: { page: 'discover', tab: 'gaming' } },
    { id: 'testimonials', label: 'Testimonials', route: { page: 'discover', tab: 'testimonials' } },
  ];

  const handleMktImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Read error'));
      r.readAsDataURL(file);
    });
    const uploaded = await apiUploadFile({
      fileName: file.name,
      mimeType: file.type,
      dataBase64,
    });
    setMktImageSrc(uploaded.url);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      {/* Sub-hub Tab Strip */}
      <div className="flex flex-wrap gap-1.5 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-2">
        {navTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onNavigate(t.route)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              mode === t.id
                ? 'bg-[var(--sp-primary)] text-white'
                : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ================= PAGES ================= */}
      {mode === 'pages' && (
        selectedPage ? (
          (() => {
            const fallbackPreset = getCategoryGuidelines(selectedPage.category);
            const effectiveRules =
              selectedPage.rules && selectedPage.rules.length > 0
                ? selectedPage.rules
                : fallbackPreset.rules;
            const effectivePolicy =
              selectedPage.postingPolicy || fallbackPreset.postingPolicy;
            const effectiveSummary =
              selectedPage.guidelinesSummary || fallbackPreset.guidelinesSummary;
            const canManagePage =
              selectedPage.ownerId === currentUser.id || currentUser.role === 'admin';
            const ownerProfile = users.find((u) => u.id === selectedPage.ownerId);

            return (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'discover', tab: 'pages' })}
                  className="text-xs font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                >
                  ← Back to All Pages ({pages.length})
                </button>

                <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl overflow-hidden">
                  <div className="h-44 sm:h-56 bg-slate-900">
                    <ImageWithFallback
                      src={selectedPage.coverImage || selectedPage.avatar}
                      alt={selectedPage.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-18 h-18 rounded-2xl overflow-hidden border-2 border-[var(--sp-surface)] shadow-md -mt-10 bg-white shrink-0">
                        <ImageWithFallback
                          src={selectedPage.avatar || selectedPage.coverImage}
                          alt={selectedPage.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h1 className="font-display text-xl font-extrabold text-[var(--sp-ink)] flex items-center gap-1.5">
                          <span className="truncate">{selectedPage.name}</span>
                          {selectedPage.verified && (
                            <BadgeCheck className="w-5 h-5 text-[var(--sp-primary-text)] shrink-0" />
                          )}
                        </h1>
                        <div className="text-xs text-[var(--sp-muted)]">
                          {selectedPage.handle.startsWith('@')
                            ? selectedPage.handle
                            : `@${selectedPage.handle}`}{' '}
                          · {selectedPage.category} · {selectedPage.location} ·{' '}
                          <span className="tabular-nums font-semibold">
                            {selectedPage.totalFollowers.toLocaleString()} followers
                          </span>
                          {selectedPage.established && (
                            <span> · Est. {selectedPage.established}</span>
                          )}
                        </div>
                        {ownerProfile && (
                          <div className="text-[11px] text-[var(--sp-muted)] mt-0.5">
                            Managed by{' '}
                            <button
                              type="button"
                              onClick={() =>
                                onNavigate({
                                  page: 'profile',
                                  userId: ownerProfile.id,
                                  tab: 'timeline',
                                })
                              }
                              className="font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                            >
                              {ownerProfile.name}
                            </button>
                            {selectedPage.govAgency && (
                              <span>
                                {' '}
                                · {selectedPage.govAgency} ({selectedPage.govRegNumber})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiTogglePageFollow(selectedPage.id, currentUser.id);
                        await onRefresh();
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer shrink-0 ${
                        selectedPage.following
                          ? 'bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)]'
                          : 'bg-[var(--sp-primary)] text-white'
                      }`}
                    >
                      {selectedPage.following ? 'Following Page' : 'Follow Page'}
                    </button>
                  </div>

                  <div className="px-5 pb-5 space-y-3">
                    <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                      {selectedPage.description}
                    </p>

                    {(selectedPage.highlights && selectedPage.highlights.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {selectedPage.highlights.map((hl) => (
                          <div
                            key={hl}
                            className="p-2.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] text-[11px] text-[var(--sp-ink-2)] leading-snug"
                          >
                            {hl}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPage.contactInfo && (
                      <div className="text-[11px] text-[var(--sp-muted)] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[var(--sp-primary-text)] shrink-0" />
                        <span>{selectedPage.contactInfo}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Page Rules & Community Guidelines */}
                <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-sm font-extrabold text-[var(--sp-ink)] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[var(--sp-primary-text)]" />
                        <span>Page Rules &amp; Community Guidelines</span>
                      </h2>
                      <p className="text-[11px] text-[var(--sp-muted)]">{effectiveSummary}</p>
                    </div>
                    {canManagePage && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPageRulesInput(effectiveRules.join('\n'));
                          setEditPagePolicyInput(effectivePolicy);
                          setEditingPageRules((v) => !v);
                          setRulesSavedNotice(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{editingPageRules ? 'Cancel' : 'Edit Rules'}</span>
                      </button>
                    )}
                  </div>

                  {rulesSavedNotice && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {rulesSavedNotice}
                    </div>
                  )}

                  {editingPageRules ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const parsed = editPageRulesInput
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean);
                        await apiUpdatePageRules(selectedPage.id, {
                          userId: currentUser.id,
                          rules: parsed,
                          postingPolicy: editPagePolicyInput,
                        });
                        setEditingPageRules(false);
                        setRulesSavedNotice('Page rules & posting policy updated.');
                        await onRefresh();
                      }}
                      className="space-y-2.5 text-xs pt-1"
                    >
                      <div>
                        <label className="block font-semibold text-[var(--sp-ink)] mb-1">
                          Posting Policy
                        </label>
                        <input
                          type="text"
                          required
                          value={editPagePolicyInput}
                          onChange={(e) => setEditPagePolicyInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[var(--sp-ink)] mb-1">
                          Page Rules (one rule per line, max 10)
                        </label>
                        <textarea
                          rows={5}
                          required
                          value={editPageRulesInput}
                          onChange={(e) => setEditPageRulesInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white font-bold cursor-pointer"
                      >
                        Save Page Rules
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="text-xs text-[var(--sp-ink-2)] bg-[var(--sp-surface-alt)] rounded-lg px-3 py-2">
                        <span className="font-bold text-[var(--sp-ink)]">Allowed Content: </span>
                        {effectivePolicy}
                      </div>
                      <ol className="space-y-1.5 text-xs text-[var(--sp-ink-2)]">
                        {effectiveRules.map((rule, idx) => (
                          <li key={`${idx}-${rule.slice(0, 18)}`} className="flex items-start gap-2">
                            <span className="font-mono-code font-bold text-[var(--sp-primary-text)] tabular-nums shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>

                {selectedPage.ownerId === currentUser.id && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!pagePostText.trim()) return;
                      await apiCreatePost({
                        authorId: currentUser.id,
                        pageId: selectedPage.id,
                        postAsPage: true,
                        content: pagePostText.trim(),
                        location: selectedPage.location,
                        privacy: 'public',
                      });
                      setPagePostText('');
                      await onRefresh();
                    }}
                    className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pagePostText}
                        onChange={(e) => setPagePostText(e.target.value)}
                        placeholder={`Post publicly as ${selectedPage.name}...`}
                        className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        Publish as Page
                      </button>
                    </div>
                    <div className="text-[11px] text-[var(--sp-muted)]">
                      Publishing adheres to {selectedPage.category} policy: {effectivePolicy}
                    </div>
                  </form>
                )}

                <div className="space-y-4">
                  {posts.filter((p) => p.pageId === selectedPage.id).length === 0 ? (
                    <div className="p-6 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] text-center text-xs text-[var(--sp-muted)]">
                      No public posts on {selectedPage.name} yet.
                      {selectedPage.ownerId === currentUser.id
                        ? ' Use the composer above to publish your first official Page post!'
                        : ''}
                    </div>
                  ) : (
                    posts
                      .filter((p) => p.pageId === selectedPage.id)
                      .map((post) => (
                        <FeedPostCard
                          key={post.id}
                          post={post}
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
                      ))
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                  Sphere. Pages
                </h1>
                <p className="text-xs text-[var(--sp-muted)]">
                  {pages.length.toLocaleString()} functional Pages across LGU civic hubs, kitchens, hardware, social works, motorcycles &amp; arts ·{' '}
                  <span className="font-semibold text-[var(--sp-ink-2)]">
                    {myPagesCount} managed by you
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePage((v) => !v)}
                className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Page</span>
              </button>
            </div>

            {showCreatePage && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiCreatePage({
                    ownerId: currentUser.id,
                    name: pageName,
                    handle: pageHandle || pageName.toLowerCase().replace(/[^a-z0-9]/g, ''),
                    category: pageCategory,
                    location: currentUser.location,
                    description: pageDesc,
                    rules: pageRulesText
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean),
                    postingPolicy: pagePolicyText,
                  });
                  setShowCreatePage(false);
                  setPageName('');
                  setPageHandle('');
                  setPageDesc('');
                  await onRefresh();
                }}
                className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={pageName}
                    onChange={(e) => setPageName(e.target.value)}
                    placeholder="Page Name"
                    className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                  <input
                    type="text"
                    value={pageHandle}
                    onChange={(e) => setPageHandle(e.target.value)}
                    placeholder="@handle"
                    className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                  <select
                    value={pageCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      setPageCategory(nextCat);
                      const nextPreset = getCategoryGuidelines(nextCat);
                      setPageRulesText(nextPreset.rules.join('\n'));
                      setPagePolicyText(nextPreset.postingPolicy);
                    }}
                    className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    {PAGE_AND_GROUP_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  value={pageDesc}
                  onChange={(e) => setPageDesc(e.target.value)}
                  placeholder="Describe your Page purpose..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <input
                  type="text"
                  value={pagePolicyText}
                  onChange={(e) => setPagePolicyText(e.target.value)}
                  placeholder="Posting policy for contributors & followers"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <textarea
                  rows={4}
                  value={pageRulesText}
                  onChange={(e) => setPageRulesText(e.target.value)}
                  placeholder="Page rules (one rule per line)"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#06B6D4] text-slate-950 font-bold cursor-pointer"
                >
                  Launch Page with Rules
                </button>
              </form>
            )}

            {/* Search, Ownership & Category Filters */}
            <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3 space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[var(--sp-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pageSearch}
                    onChange={(e) => {
                      setPageSearch(e.target.value);
                      setPageNum(1);
                    }}
                    placeholder="Search Pages (e.g. Labo, Cassava, GPU, Social Works, Motorcycles, Arts)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPageOwnerFilter('all');
                      setPageNum(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      pageOwnerFilter === 'all'
                        ? 'bg-[var(--sp-primary)] text-white'
                        : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                    }`}
                  >
                    All ({pages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPageOwnerFilter('mine');
                      setPageNum(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      pageOwnerFilter === 'mine'
                        ? 'bg-[var(--sp-primary)] text-white'
                        : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                    }`}
                  >
                    Managed by You ({myPagesCount})
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {pageCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setPageCatFilter(cat);
                      setPageNum(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                      pageCatFilter === cat
                        ? 'bg-[#06B6D4] text-slate-950'
                        : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] hover:text-[var(--sp-ink)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedPages.map((pg) => (
                <div
                  key={pg.id}
                  className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="h-32 bg-slate-900 relative">
                    <ImageWithFallback
                      src={pg.coverImage || pg.avatar}
                      alt={pg.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-11 h-11 rounded-xl overflow-hidden border border-[var(--sp-border)] bg-white shrink-0 -mt-8 shadow-sm">
                          <ImageWithFallback
                            src={pg.avatar || pg.coverImage}
                            alt={pg.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-display text-sm font-extrabold text-[var(--sp-ink)] flex items-center gap-1 min-w-0">
                              <span className="truncate">{pg.name}</span>
                              {pg.verified && (
                                <BadgeCheck className="w-4 h-4 text-[var(--sp-primary-text)] shrink-0" />
                              )}
                            </h3>
                            <span className="text-[11px] font-mono-code text-[var(--sp-muted)] tabular-nums shrink-0">
                              {pg.totalFollowers.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--sp-muted)] truncate">
                            {pg.category} · {pg.location}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--sp-ink-2)] mt-2 line-clamp-2">
                        {pg.description}
                      </p>
                      <div className="text-[11px] text-[var(--sp-muted)] mt-1.5 truncate">
                        {(pg.rules?.length || 5)} Page Rules · {pg.postingPolicy || 'Verified community guidelines'}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onNavigate({ page: 'discover', tab: 'pages', pageId: pg.id })}
                        className="flex-1 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
                      >
                        Open Page
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiTogglePageFollow(pg.id, currentUser.id);
                          await onRefresh();
                        }}
                        className="px-3 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold cursor-pointer"
                      >
                        {pg.following ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPageViews > 1 && (
              <div className="flex items-center justify-between bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl px-4 py-2.5 text-xs">
                <span className="text-[var(--sp-muted)] tabular-nums">
                  Showing {(safePageNum - 1) * PAGES_PER_VIEW + 1}–
                  {Math.min(safePageNum * PAGES_PER_VIEW, filteredPages.length)} of{' '}
                  {filteredPages.length} Pages
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePageNum <= 1}
                    onClick={() => setPageNum((n) => Math.max(1, n - 1))}
                    className="px-2.5 py-1 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="font-mono-code font-bold px-2 tabular-nums">
                    {safePageNum} / {totalPageViews}
                  </span>
                  <button
                    type="button"
                    disabled={safePageNum >= totalPageViews}
                    onClick={() => setPageNum((n) => Math.min(totalPageViews, n + 1))}
                    className="px-2.5 py-1 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ================= CIRCLES (GROUPS) ================= */}
      {mode === 'groups' && (
        selectedGroup ? (
          (() => {
            const fallbackPreset = getCategoryGuidelines(selectedGroup.category, true);
            const effectiveRules =
              selectedGroup.rules && selectedGroup.rules.length > 0
                ? selectedGroup.rules
                : fallbackPreset.rules;
            const effectivePolicy =
              selectedGroup.postingPolicy || fallbackPreset.postingPolicy;
            const effectiveSummary =
              selectedGroup.guidelinesSummary || fallbackPreset.guidelinesSummary;
            const canManageGroup =
              selectedGroup.creatorId === currentUser.id || currentUser.role === 'admin';

            return (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'discover', tab: 'groups' })}
                  className="text-xs font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                >
                  ← Back to All Circles
                </button>
                <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono-code font-bold text-[var(--sp-accent-text)]">
                      {selectedGroup.privacy === 'private' ? 'Private Circle' : 'Public Circle'} ·{' '}
                      {selectedGroup.category}
                    </div>
                    <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                      {selectedGroup.name}
                    </h1>
                    <p className="text-xs text-[var(--sp-ink-2)] mt-1">{selectedGroup.description}</p>
                    <div className="text-[11px] text-[var(--sp-muted)] mt-1">
                      {selectedGroup.location} · {selectedGroup.totalMembers} members
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiToggleGroupJoin(selectedGroup.id, currentUser.id);
                      await onRefresh();
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer shrink-0 ${
                      selectedGroup.joined
                        ? 'bg-[var(--sp-surface-alt)] border border-[var(--sp-border)]'
                        : 'bg-[#06B6D4] text-slate-950'
                    }`}
                  >
                    {selectedGroup.joined ? 'Joined Circle' : 'Join Circle'}
                  </button>
                </div>

                {/* Circle House Rules & Community Guidelines */}
                <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-sm font-extrabold text-[var(--sp-ink)] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[var(--sp-primary-text)]" />
                        <span>Circle House Rules &amp; Member Guidelines</span>
                      </h2>
                      <p className="text-[11px] text-[var(--sp-muted)]">{effectiveSummary}</p>
                    </div>
                    {canManageGroup && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditGroupRulesInput(effectiveRules.join('\n'));
                          setEditGroupPolicyInput(effectivePolicy);
                          setEditingGroupRules((v) => !v);
                          setRulesSavedNotice(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{editingGroupRules ? 'Cancel' : 'Edit Rules'}</span>
                      </button>
                    )}
                  </div>

                  {rulesSavedNotice && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {rulesSavedNotice}
                    </div>
                  )}

                  {editingGroupRules ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const parsed = editGroupRulesInput
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean);
                        await apiUpdateGroupRules(selectedGroup.id, {
                          userId: currentUser.id,
                          rules: parsed,
                          postingPolicy: editGroupPolicyInput,
                        });
                        setEditingGroupRules(false);
                        setRulesSavedNotice('Circle rules updated.');
                        await onRefresh();
                      }}
                      className="space-y-2.5 text-xs pt-1"
                    >
                      <input
                        type="text"
                        required
                        value={editGroupPolicyInput}
                        onChange={(e) => setEditGroupPolicyInput(e.target.value)}
                        placeholder="Circle discussion policy"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                      <textarea
                        rows={5}
                        required
                        value={editGroupRulesInput}
                        onChange={(e) => setEditGroupRulesInput(e.target.value)}
                        placeholder="One rule per line"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white font-bold cursor-pointer"
                      >
                        Save Circle Rules
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="text-xs text-[var(--sp-ink-2)] bg-[var(--sp-surface-alt)] rounded-lg px-3 py-2">
                        <span className="font-bold text-[var(--sp-ink)]">Posting Policy: </span>
                        {effectivePolicy}
                      </div>
                      <ol className="space-y-1.5 text-xs text-[var(--sp-ink-2)]">
                        {effectiveRules.map((rule, idx) => (
                          <li key={`${idx}-${rule.slice(0, 18)}`} className="flex items-start gap-2">
                            <span className="font-mono-code font-bold text-[var(--sp-primary-text)] tabular-nums shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>

                {selectedGroup.privacy === 'private' && !selectedGroup.joined ? (
                  <div className="p-8 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] text-center space-y-2 text-xs text-[var(--sp-muted)]">
                    <Lock className="w-6 h-6 mx-auto text-[var(--sp-primary-text)]" />
                    <p>Join this Private Circle to read and participate in discussions.</p>
                  </div>
                ) : (
                  <>
                    {selectedGroup.joined && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!groupPostText.trim()) return;
                          await apiCreatePost({
                            authorId: currentUser.id,
                            groupId: selectedGroup.id,
                            content: groupPostText.trim(),
                            location: selectedGroup.location,
                            privacy: selectedGroup.privacy === 'private' ? 'friends_only' : 'public',
                          });
                          setGroupPostText('');
                          await onRefresh();
                        }}
                        className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 flex gap-2"
                      >
                        <input
                          type="text"
                          value={groupPostText}
                          onChange={(e) => setGroupPostText(e.target.value)}
                          placeholder={`Share an update in ${selectedGroup.name}...`}
                          className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer"
                        >
                          Post
                        </button>
                      </form>
                    )}
                    <div className="space-y-4">
                      {posts
                        .filter((p) => p.groupId === selectedGroup.id)
                        .map((post) => (
                          <FeedPostCard
                            key={post.id}
                            post={post}
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
                        ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                  Sphere. Circles
                </h1>
                <p className="text-xs text-[var(--sp-muted)]">
                  Public and private communities around hardware, social works, motorcycles, art, baking, and towns—each with tailored member rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroup((v) => !v)}
                className="px-4 py-2 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Circle</span>
              </button>
            </div>

            {showCreateGroup && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiCreateGroup({
                    creatorId: currentUser.id,
                    name: groupName,
                    category: groupCategory,
                    location: currentUser.location,
                    description: groupDesc,
                    privacy: groupPrivacy,
                    rules: groupRulesText
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean),
                    postingPolicy: groupPolicyText,
                  });
                  setShowCreateGroup(false);
                  setGroupName('');
                  setGroupDesc('');
                  await onRefresh();
                }}
                className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Circle Name"
                    className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  />
                  <select
                    value={groupCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      setGroupCategory(nextCat);
                      const nextPreset = getCategoryGuidelines(nextCat, true);
                      setGroupRulesText(nextPreset.rules.join('\n'));
                      setGroupPolicyText(nextPreset.postingPolicy);
                    }}
                    className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    {PAGE_AND_GROUP_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <select
                    value={groupPrivacy}
                    onChange={(e) => setGroupPrivacy(e.target.value as 'public' | 'private')}
                    className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                  >
                    <option value="public">Public Circle</option>
                    <option value="private">Private Circle</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Circle mission..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <input
                  type="text"
                  value={groupPolicyText}
                  onChange={(e) => setGroupPolicyText(e.target.value)}
                  placeholder="Member posting policy"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <textarea
                  rows={4}
                  value={groupRulesText}
                  onChange={(e) => setGroupRulesText(e.target.value)}
                  placeholder="Circle rules (one per line)"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white font-bold cursor-pointer"
                >
                  Create Circle with Rules
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((gr) => (
                <div
                  key={gr.id}
                  className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-mono-code text-[var(--sp-accent-text)]">
                        {gr.privacy === 'private' ? 'Private' : 'Public'} · {gr.category}
                      </div>
                      <h3 className="font-display text-base font-extrabold text-[var(--sp-ink)]">
                        {gr.name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono-code text-[var(--sp-muted)] tabular-nums">
                      {gr.totalMembers} members
                    </span>
                  </div>
                  <p className="text-xs text-[var(--sp-ink-2)]">{gr.description}</p>
                  <div className="text-[11px] text-[var(--sp-muted)] truncate">
                    {(gr.rules?.length || 5)} Circle Rules · {gr.postingPolicy || 'Member guidelines active'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: 'discover', tab: 'groups', groupId: gr.id })}
                      className="flex-1 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
                    >
                      Enter Circle
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiToggleGroupJoin(gr.id, currentUser.id);
                        await onRefresh();
                      }}
                      className="px-3 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold cursor-pointer"
                    >
                      {gr.joined ? 'Joined' : 'Join'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ================= SHELVES (MARKETPLACE WITH OPTIONAL INTERACTION TOGGLE) ================= */}
      {mode === 'marketplace' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                Sphere. Shelves
              </h1>
              <p className="text-xs text-[var(--sp-muted)]">
                Local artisan treats, prints, studio gear, and community crafts with seller-controlled comments &amp; reactions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateListing((v) => !v)}
              className="px-4 py-2 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer self-start"
            >
              <Plus className="w-4 h-4" />
              <span>List Item on Shelves</span>
            </button>
          </div>

          {showCreateListing && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiCreateMarketplaceItem({
                  sellerId: currentUser.id,
                  title: mktTitle,
                  price: Number(mktPrice),
                  category: mktCatInput,
                  condition: mktCond,
                  location: currentUser.location,
                  description: mktDesc,
                  imageSrc: mktImageSrc || undefined,
                  privacy: mktPrivacy,
                  allowCommentsAndReactions: mktAllowInteract,
                  crossPostToFeed: mktCrossPost,
                });
                setShowCreateListing(false);
                setMktTitle('');
                setMktDesc('');
                setMktImageSrc('');
                await onRefresh();
              }}
              className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-3 text-xs"
            >
              <div className="font-display text-sm font-bold text-[var(--sp-ink)]">
                Create Shelves Listing
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={mktTitle}
                  onChange={(e) => setMktTitle(e.target.value)}
                  placeholder="Product title"
                  className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <input
                  type="number"
                  required
                  min={1}
                  value={mktPrice}
                  onChange={(e) => setMktPrice(Number(e.target.value))}
                  placeholder="Price (PHP)"
                  className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <input
                  type="text"
                  value={mktCatInput}
                  onChange={(e) => setMktCatInput(e.target.value)}
                  placeholder="Category"
                  className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={mktCond}
                  onChange={(e) => setMktCond(e.target.value as MarketplaceItem['condition'])}
                  className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                >
                  <option>Brand New</option>
                  <option>Like New</option>
                  <option>Good</option>
                  <option>Vintage</option>
                </select>
                <select
                  value={mktPrivacy}
                  onChange={(e) => setMktPrivacy(e.target.value as PrivacyLevel)}
                  className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                >
                  <option value="public">Everyone</option>
                  <option value="friends_of_friends">Friends of Friends</option>
                  <option value="friends_only">Friends Only</option>
                  <option value="only_me">Only Me (Draft)</option>
                </select>
              </div>
              <textarea
                rows={2}
                required
                value={mktDesc}
                onChange={(e) => setMktDesc(e.target.value)}
                placeholder="Describe ingredients, dimensions, or meetup details..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="px-3 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] cursor-pointer font-semibold">
                  Upload Product Image
                  <input type="file" accept="image/*" onChange={handleMktImageUpload} className="hidden" />
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mktAllowInteract}
                    onChange={(e) => setMktAllowInteract(e.target.checked)}
                    className="accent-[#4F46E5]"
                  />
                  <span>Allow comments &amp; reactions on this listing</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mktCrossPost}
                    onChange={(e) => setMktCrossPost(e.target.checked)}
                    className="accent-[#4F46E5]"
                  />
                  <span>Share to Pulse Feed</span>
                </label>
              </div>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[var(--sp-primary)] text-white font-bold cursor-pointer"
              >
                Publish to Shelves
              </button>
            </form>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-3">
            <div className="flex flex-wrap gap-1">
              {mktCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMktCategory(cat)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    mktCategory === cat
                      ? 'bg-[var(--sp-primary)] text-white'
                      : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={mktSearch}
              onChange={(e) => setMktSearch(e.target.value)}
              placeholder="Search Shelves..."
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>

          {/* Product Detail Drawer/Card if selectedListing */}
          {selectedListing && (
            <div className="bg-[var(--sp-surface)] border-2 border-[var(--sp-primary)] rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-5 rounded-xl overflow-hidden bg-slate-900 max-h-72 relative group">
                <ImageWithFallback
                  src={selectedListing.imageSrc}
                  alt={selectedListing.title}
                  lightboxTitle={selectedListing.title}
                  lightboxSubtitle={`₱${selectedListing.price.toLocaleString()} · ${selectedListing.condition} · ${selectedListing.location}`}
                  lightboxDescription={selectedListing.description}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono-code font-bold text-[var(--sp-accent-text)]">
                      {selectedListing.category} · {selectedListing.condition}
                    </div>
                    <h2 className="font-display text-xl font-extrabold text-[var(--sp-ink)]">
                      {selectedListing.title}
                    </h2>
                    <div className="text-lg font-mono-code font-extrabold text-[var(--sp-primary-text)] tabular-nums">
                      ₱{selectedListing.price.toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'marketplace' })}
                    className="p-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                  {selectedListing.description}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMessageUser(selectedListing.sellerId)}
                    className="px-4 py-2 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Message Seller</span>
                  </button>
                  {selectedListing.sellerId === currentUser.id && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiToggleMarketplaceSold(selectedListing.id, currentUser.id);
                        await onRefresh();
                      }}
                      className="px-4 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold cursor-pointer"
                    >
                      {selectedListing.sold ? 'Relist Item' : 'Mark as Sold'}
                    </button>
                  )}
                </div>

                {/* Seller-controlled reactions & comments */}
                {selectedListing.allowCommentsAndReactions !== false ? (
                  <div className="pt-3 border-t border-[var(--sp-border-subtle)] space-y-3">
                    <ReactionControls
                      currentUserId={currentUser.id}
                      reactions={selectedListing.reactions}
                      tracker={selectedListing.reactionTracker}
                      hideCounts={hideCounts}
                      onReact={async (type: ReactionType) => {
                        await apiReactMarketplaceItem(selectedListing.id, currentUser.id, type);
                        await onRefresh();
                      }}
                    />

                    <div className="space-y-2">
                      {(selectedListing.comments || []).map((c) => {
                        const ca = users.find((u) => u.id === c.authorId);
                        return (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-lg bg-[var(--sp-surface-alt)] text-xs"
                          >
                            <span className="font-bold text-[var(--sp-ink)]">{ca?.name}: </span>
                            <span className="text-[var(--sp-ink-2)]">{c.text}</span>
                          </div>
                        );
                      })}
                      {mktCommentError && (
                        <div className="text-xs text-red-500">{mktCommentError}</div>
                      )}
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!mktCommentText.trim()) return;
                          setMktCommentError(null);
                          try {
                            await apiCommentMarketplaceItem(
                              selectedListing.id,
                              currentUser.id,
                              mktCommentText.trim()
                            );
                            setMktCommentText('');
                            await onRefresh();
                          } catch (err) {
                            setMktCommentError(
                              err instanceof Error ? err.message : 'Comment failed.'
                            );
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={mktCommentText}
                          onChange={(e) => setMktCommentText(e.target.value)}
                          placeholder="Ask a question about this item..."
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--sp-muted)] pt-2 border-t border-[var(--sp-border-subtle)]">
                    Direct message mode enabled by seller — comments &amp; public reactions are turned off for this item.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarketplace.map((item) => {
              const seller = users.find((u) => u.id === item.sellerId);
              return (
                <div
                  key={item.id}
                  className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl overflow-hidden flex flex-col"
                >
                  <div
                    onClick={() => onNavigate({ page: 'marketplace', listingId: item.id })}
                    className="h-44 bg-slate-900 overflow-hidden cursor-pointer relative group"
                  >
                    <ImageWithFallback
                      src={item.imageSrc}
                      alt={item.title}
                      onClick={(e) => {
                        if (!item.imageSrc) return;
                        e.stopPropagation();
                        openImage({
                          src: item.imageSrc,
                          title: item.title,
                          subtitle: `₱${item.price.toLocaleString()} · ${item.condition} · ${item.location}`,
                          badge: 'Marketplace Shelves',
                          description: item.description,
                          actionLabel: 'Open Listing Details',
                          onAction: () =>
                            onNavigate({ page: 'marketplace', listingId: item.id }),
                          gallery: filteredMarketplace
                            .filter((m): m is typeof m & { imageSrc: string } => Boolean(m.imageSrc))
                            .map((m) => ({
                              src: m.imageSrc,
                              title: m.title,
                              subtitle: `₱${m.price.toLocaleString()} · ${m.location}`,
                            })),
                        });
                      }}
                      className="w-full h-full object-cover hover:scale-105 transition-transform cursor-zoom-in"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate({ page: 'marketplace', listingId: item.id });
                      }}
                      title="Open product details"
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-950 text-white text-[10px] font-semibold inline-flex items-center gap-1 opacity-85 hover:opacity-100 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Details</span>
                    </button>
                    {item.sold && (
                      <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center text-white font-display font-extrabold text-sm pointer-events-none">
                        SOLD
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-mono-code font-extrabold text-[var(--sp-primary-text)] tabular-nums">
                          ₱{item.price.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-[var(--sp-muted)]">{item.condition}</span>
                      </div>
                      <h3 className="font-display text-sm font-bold text-[var(--sp-ink)] mt-0.5">
                        {item.title}
                      </h3>
                      <div className="text-[11px] text-[var(--sp-muted)] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span>{item.location}</span>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() =>
                            seller && onNavigate({ page: 'profile', userId: seller.id, tab: 'timeline' })
                          }
                          className="font-semibold text-[var(--sp-ink-2)] hover:text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                        >
                          {seller?.name.split(' ')[0]}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onNavigate({ page: 'marketplace', listingId: item.id })}
                        className="flex-1 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold cursor-pointer"
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => onMessageUser(item.sellerId)}
                        className="px-3 py-1.5 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Message Seller
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= LOOPS & VIDEOS ================= */}
      {mode === 'videos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                Loops &amp; Videos
              </h1>
              <p className="text-xs text-[var(--sp-muted)]">
                Loops (9:16 short clips up to 3 minutes) and full 16:9 widescreen Videos.
              </p>
            </div>
            <div className="flex gap-1">
              {(
                [
                  { id: 'all', label: 'All Clips' },
                  { id: 'short', label: 'Loops (9:16 ≤3m)' },
                  { id: 'long', label: 'Videos (16:9)' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVideoFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    videoFilter === f.id
                      ? 'bg-[#06B6D4] text-slate-950'
                      : 'bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-ink-2)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videoPosts.map((post) => {
              const author = users.find((u) => u.id === post.authorId);
              return (
                <div
                  key={post.id}
                  className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3"
                >
                  <button
                    type="button"
                    onClick={() =>
                      author && onNavigate({ page: 'profile', userId: author.id, tab: 'timeline' })
                    }
                    className="flex items-center gap-2 text-xs text-left cursor-pointer group"
                  >
                    <UserAvatar user={author} size="sm" />
                    <div>
                      <div className="font-bold text-[var(--sp-ink)] group-hover:underline">{author?.name}</div>
                      <div className="text-[11px] text-[var(--sp-muted)]">{post.location}</div>
                    </div>
                  </button>
                  {post.video && <VideoPlayer video={post.video} />}
                  <p className="text-xs text-[var(--sp-ink-2)]">{post.content}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= ON LIVE ================= */}
      {mode === 'live' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                On Live Broadcasts
              </h1>
              <p className="text-xs text-[var(--sp-muted)]">
                Real-time camera streams and saved On Live studio replays across Sphere.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLive()}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>Start On Live</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {livePosts.map((lp) => {
              const host = users.find((u) => u.id === lp.authorId);
              return (
                <div
                  key={lp.id}
                  className="p-5 rounded-xl bg-slate-900 text-white space-y-3 border border-slate-800"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-code font-bold text-[#22D3EE]">
                      {lp.liveStream?.isLive ? 'ON LIVE NOW' : 'REPLAY'} ·{' '}
                      {lp.liveStream?.viewerCount} viewers
                    </span>
                    <span className="text-slate-400">{lp.liveStream?.durationLabel}</span>
                  </div>
                  <h3 className="font-display text-base font-bold">{lp.liveStream?.title}</h3>
                  <div className="text-xs text-slate-300">Hosted by {host?.name}</div>
                  <button
                    type="button"
                    onClick={() => onOpenLive(lp)}
                    className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold cursor-pointer"
                  >
                    {lp.liveStream?.isLive ? 'Join Live Broadcast' : 'Watch Replay'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= IMAGES & FRAMES ================= */}
      {mode === 'photos' && (
        <div className="space-y-6">
          <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5">
            <AlbumsPanel
              ownerId={currentUser.id}
              currentUser={currentUser}
              albums={albums}
              photos={photos}
              onRefresh={onRefresh}
              onOpenPhoto={onOpenPhoto}
            />
          </div>

          <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-4">
            <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
              Community Images Feed
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((ph) => {
                const postedPage = ph.pageId ? pages.find((pg) => pg.id === ph.pageId) : undefined;
                const owner = users.find((u) => u.id === ph.ownerId);
                return (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => onOpenPhoto(ph.id)}
                    className="group rounded-xl overflow-hidden border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] text-left cursor-pointer"
                  >
                    <div className="aspect-square overflow-hidden">
                      <ImageWithFallback
                        src={ph.src}
                        alt={ph.caption}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-2 text-[11px] truncate font-semibold text-[var(--sp-ink)]">
                      {ph.postAsPage && postedPage ? postedPage.name : owner?.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= ORBIT PEOPLE / FRIENDS ================= */}
      {mode === 'friends' && (() => {
        const q = orbitFriendSearch.trim().toLowerCase();
        const filteredOrbitUsers = users.filter((u) => {
          if (u.id === currentUser.id) return false;
          if (!q) return true;
          return (
            u.name.toLowerCase().includes(q) ||
            u.handle.toLowerCase().includes(q) ||
            u.location.toLowerCase().includes(q) ||
            (u.country || '').toLowerCase().includes(q)
          );
        });
        const visibleOrbitUsers = filteredOrbitUsers.slice(0, orbitFriendsLimit);

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                  Orbit · Friends &amp; People You May Know
                </h1>
                <p className="text-xs text-[var(--sp-muted)]">
                  {filteredOrbitUsers.length.toLocaleString()} Sphere accounts connected across the world
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[var(--sp-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={orbitFriendSearch}
                  onChange={(e) => {
                    setOrbitFriendSearch(e.target.value);
                    setOrbitFriendsLimit(24);
                  }}
                  placeholder="Search name, @handle, city, or org..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleOrbitUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={u} size="lg" isOnline={onlineUserIds.includes(u.id)} />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onNavigate({ page: 'profile', userId: u.id, tab: 'timeline' })}
                        className="font-display text-sm font-extrabold text-[var(--sp-ink)] hover:underline truncate block cursor-pointer"
                      >
                        {u.name}
                      </button>
                      <SphereIdBadge
                        category={getEffectiveSphereId(u)}
                        onOpenSphereId={onOpenSphereId}
                      />
                      <div className="text-[11px] text-[var(--sp-muted)] truncate mt-0.5">
                        {u.location} · {u.mutualFriends} mutual
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--sp-ink-2)] line-clamp-2">{u.status}</p>
                  <div className="flex gap-2">
                    {u.friendship === 'requested_incoming' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiToggleFriend(u.id, currentUser.id, 'accept');
                          await onRefresh();
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiToggleFriend(u.id, currentUser.id, 'toggle');
                          await onRefresh();
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer ${
                          u.friendship === 'friends'
                            ? 'bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-[var(--sp-ink)]'
                            : 'bg-[var(--sp-primary)] text-white'
                        }`}
                      >
                        {u.friendship === 'friends' ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Friends</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>
                              {u.friendship === 'requested_outgoing' ? 'Requested' : 'Connect'}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onMessageUser(u.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Chat
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredOrbitUsers.length > orbitFriendsLimit && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
                <span className="text-xs text-[var(--sp-muted)]">
                  Showing {visibleOrbitUsers.length.toLocaleString()} of{' '}
                  {filteredOrbitUsers.length.toLocaleString()} Sphere friends &amp; members
                </span>
                <button
                  type="button"
                  onClick={() => setOrbitFriendsLimit((prev) => prev + 36)}
                  className="px-4 py-2 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold cursor-pointer"
                >
                  Load More Friends
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ================= GAMING HUB ================= */}
      {mode === 'gaming' && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono-code font-bold text-[#06B6D4] uppercase">
                Sphere. Gaming Arcade
              </div>
              <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                Community Trivia &amp; Creator Quests
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono-code font-bold text-[var(--sp-primary-text)]">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Score: {triviaScore} / {LABO_TRIVIA.length}</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-3">
            <div className="text-xs font-mono-code text-[var(--sp-muted)]">
              Question {triviaIndex + 1} of {LABO_TRIVIA.length}
            </div>
            <p className="font-display text-base font-bold text-[var(--sp-ink)]">
              {LABO_TRIVIA[triviaIndex].q}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LABO_TRIVIA[triviaIndex].options.map((opt, idx) => {
                const answered = triviaPicked !== null;
                const isCorrect = idx === LABO_TRIVIA[triviaIndex].answer;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={answered}
                    onClick={() => {
                      setTriviaPicked(idx);
                      if (isCorrect) setTriviaScore((s) => s + 1);
                    }}
                    className={`p-3 rounded-lg border text-xs font-semibold text-left cursor-pointer ${
                      !answered
                        ? 'bg-[var(--sp-surface)] border-[var(--sp-border)] hover:border-[var(--sp-primary)]'
                        : isCorrect
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : idx === triviaPicked
                            ? 'bg-red-500/15 border-red-500 text-red-600'
                            : 'bg-[var(--sp-surface)] border-[var(--sp-border)] opacity-60'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {triviaPicked !== null && (
              <button
                type="button"
                onClick={() => {
                  setTriviaPicked(null);
                  if (triviaIndex < LABO_TRIVIA.length - 1) {
                    setTriviaIndex((i) => i + 1);
                  } else {
                    setTriviaIndex(0);
                    setTriviaScore(0);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold cursor-pointer"
              >
                {triviaIndex < LABO_TRIVIA.length - 1 ? 'Next Question →' : 'Play Again'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= TESTIMONIALS ================= */}
      {(mode === 'testimonials' || mode === 'trending') && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-6 space-y-4">
          <h1 className="font-display text-2xl font-extrabold text-[var(--sp-ink)] flex items-center gap-2">
            <Quote className="w-5 h-5 text-[var(--sp-primary-text)]" />
            <span>Member Testimonials</span>
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map((t) => {
              const author = users.find((u) => u.id === t.authorId);
              const recipient = users.find((u) => u.id === t.recipientId);
              return (
                <div
                  key={t.id}
                  className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-2"
                >
                  <div className="text-xs font-bold text-[var(--sp-ink)]">
                    <button
                      type="button"
                      onClick={() =>
                        author &&
                        onNavigate({ page: 'profile', userId: author.id, tab: 'timeline' })
                      }
                      className="hover:underline cursor-pointer"
                    >
                      {author?.name}
                    </button>{' '}
                    →{' '}
                    <button
                      type="button"
                      onClick={() =>
                        recipient &&
                        onNavigate({ page: 'profile', userId: recipient.id, tab: 'testimonials' })
                      }
                      className="text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                    >
                      {recipient?.name}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--sp-ink-2)] italic">“{t.quote}”</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
