import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Edit3,
  Globe,
  HeartHandshake,
  Languages,
  MapPin,
  MessageCircle,
  Search,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { DiscoveryCategory, NavRoute, UserProfile } from '../types/social';
import { fetchGlobalDirectory } from '../utils/api';
import {
  DISCOVERY_CATEGORIES,
  computeInterestMatch,
  getEffectiveSphereId,
} from '../utils/discovery';
import {
  DirectoryQueryResult,
  GLOBAL_DIRECTORY_COUNTRIES,
  TOTAL_GLOBAL_DIRECTORY_COUNT,
} from '../utils/globalDirectory';
import { UserAvatar } from './Media';
import { SphereIdBadge } from './SphereIdBadge';

interface GlobalCircleViewProps {
  activeTab: 'circle' | 'find-people';
  initialCategory?: DiscoveryCategory | 'All';
  totalGlobalPopulation?: number;
  users: UserProfile[];
  currentUser: UserProfile;
  onlineUserIds: string[];
  onNavigate: (route: NavRoute) => void;
  onToggleFriend: (userId: string) => Promise<void> | void;
  onMessageUser: (userId: string) => void;
  onEditProfile: () => void;
  onOpenSphereId: () => void;
}

export const GlobalCircleView: React.FC<GlobalCircleViewProps> = ({
  activeTab,
  initialCategory = 'All',
  totalGlobalPopulation = TOTAL_GLOBAL_DIRECTORY_COUNT,
  users,
  currentUser,
  onlineUserIds,
  onNavigate,
  onToggleFriend,
  onMessageUser,
  onEditProfile,
  onOpenSphereId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<DiscoveryCategory | 'All'>(
    initialCategory
  );
  const [interestFilter, setInterestFilter] = useState('');
  const [page, setPage] = useState(1);
  const [directoryResult, setDirectoryResult] = useState<DirectoryQueryResult | null>(null);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  const combinedQuery = useMemo(() => {
    const parts = [searchQuery.trim(), interestFilter.trim()].filter(Boolean);
    return parts.join(' ');
  }, [searchQuery, interestFilter]);

  useEffect(() => {
    setPage(1);
  }, [combinedQuery, selectedCountry, selectedCategory]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoadingDirectory(true);
      try {
        const res = await fetchGlobalDirectory({
          viewerId: currentUser.id,
          page,
          limit: 24,
          q: combinedQuery,
          country: selectedCountry,
          category: selectedCategory,
        });
        if (active) setDirectoryResult(res);
      } catch {
        // Keep previous slice on transient failure
      } finally {
        if (active) setLoadingDirectory(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [currentUser.id, page, combinedQuery, selectedCountry, selectedCategory, users]);

  const availableCountries = useMemo(() => {
    const set = new Set<string>(GLOBAL_DIRECTORY_COUNTRIES);
    for (const u of users) {
      if (u.id === currentUser.id) continue;
      const c = u.country || u.location.split(',').pop()?.trim();
      if (c) set.add(c);
    }
    return ['All', ...Array.from(set).sort()];
  }, [users, currentUser.id]);

  const availableLanguages = useMemo(() => {
    return [
      'All',
      'English',
      'Tagalog',
      'Bikol',
      'Japanese',
      'Korean',
      'Spanish',
      'French',
      'German',
      'Portuguese',
      'Hindi',
      'Mandarin',
    ];
  }, []);

  const userRelationshipMap = useMemo(() => {
    const map = new Map<string, UserProfile['friendship']>();
    for (const u of users) {
      map.set(u.id, u.friendship);
    }
    return map;
  }, [users]);

  const displayedCards = useMemo(() => {
    const merged: { person: UserProfile; match: { score: number; allShared: string[] } }[] = [];
    const seen = new Set<string>();

    // On page 1, include matching live local community members first if they match filters
    if (page === 1) {
      for (const person of users) {
        if (person.id === currentUser.id || person.id.startsWith('virt-')) continue;
        const personCountry = person.country || person.location.split(',').pop()?.trim() || '';
        if (selectedCountry !== 'All' && personCountry !== selectedCountry) continue;
        if (
          selectedLanguage !== 'All' &&
          !(person.language || '').toLowerCase().includes(selectedLanguage.toLowerCase())
        ) {
          continue;
        }
        if (selectedCategory !== 'All' && !(person.categories || []).includes(selectedCategory)) {
          continue;
        }
        if (combinedQuery) {
          const hay = [
            person.name,
            person.handle,
            person.location,
            person.bio,
            ...person.interests,
            ...(person.hobbies || []),
            ...(person.skills || []),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(combinedQuery.toLowerCase())) continue;
        }
        seen.add(person.id);
        merged.push({ person, match: computeInterestMatch(currentUser, person) });
      }
    }

    const dirItems = directoryResult?.items || [];
    for (const item of dirItems) {
      if (seen.has(item.id) || item.id === currentUser.id) continue;
      if (
        selectedLanguage !== 'All' &&
        !(item.language || '').toLowerCase().includes(selectedLanguage.toLowerCase())
      ) {
        continue;
      }
      const liveFriendship = userRelationshipMap.get(item.id) || item.friendship;
      const person: UserProfile = { ...item, friendship: liveFriendship };
      const match = computeInterestMatch(currentUser, person);
      merged.push({ person, match });
    }

    if (activeTab === 'find-people') {
      return [...merged].sort((a, b) => b.match.score - a.match.score);
    }
    return merged;
  }, [
    page,
    users,
    currentUser,
    selectedCountry,
    selectedLanguage,
    selectedCategory,
    combinedQuery,
    directoryResult,
    userRelationshipMap,
    activeTab,
  ]);

  const hideCounts = Boolean(currentUser.popularitySettings?.hideFollowerCounts);
  const totalPages = directoryResult?.totalPages || Math.ceil(totalGlobalPopulation / 24);
  const totalMatched = directoryResult?.totalMatched || totalGlobalPopulation;

  return (
    <div className="space-y-4">
      <section className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono-code font-semibold text-[var(--sp-accent-text)] uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {totalGlobalPopulation.toLocaleString()} Global Members · 20+ International Hubs
              </span>
            </div>
            <h1 className="mt-1 font-display text-xl font-extrabold text-[var(--sp-ink)]">
              {activeTab === 'find-people' ? 'Find Your People Worldwide' : 'Global Circle Directory'}
            </h1>
            <p className="text-xs text-[var(--sp-muted)] mt-0.5 max-w-2xl leading-relaxed">
              Browse {totalGlobalPopulation.toLocaleString()} community members across Tokyo, Seoul, Manila, Labo, London, Berlin, San Francisco, New York, São Paulo, and beyond.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center p-1 bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] rounded-lg"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'circle'}
                onClick={() =>
                  onNavigate({ page: 'global', tab: 'circle', category: selectedCategory })
                }
                className={`px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'circle'
                    ? 'bg-[var(--sp-primary)] text-white'
                    : 'text-[var(--sp-muted)] hover:text-[var(--sp-ink)]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Global Circle</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'find-people'}
                onClick={() =>
                  onNavigate({ page: 'global', tab: 'find-people', category: selectedCategory })
                }
                className={`px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'find-people'
                    ? 'bg-[#06B6D4] text-[#0F172A]'
                    : 'text-[var(--sp-muted)] hover:text-[var(--sp-ink)]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Find Your People</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3.5 rounded-lg bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" aria-hidden="true" />
              <span>Your active matching signals</span>
            </div>
            <p className="text-[11px] text-[var(--sp-ink-2)] mt-1 leading-relaxed">
              <strong>Interests:</strong> {currentUser.interests.join(', ') || 'None set'}
              {currentUser.hobbies && currentUser.hobbies.length > 0 && (
                <> · <strong>Hobbies:</strong> {currentUser.hobbies.join(', ')}</>
              )}
              {currentUser.skills && currentUser.skills.length > 0 && (
                <> · <strong>Skills:</strong> {currentUser.skills.join(', ')}</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onEditProfile}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-primary-text)] hover:border-[var(--sp-primary)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Update Interests &amp; Goals</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-[var(--sp-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people, cities, @handles..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] rounded-md text-[var(--sp-ink)]"
            />
          </div>

          <input
            type="text"
            value={interestFilter}
            onChange={(e) => setInterestFilter(e.target.value)}
            placeholder="Filter by interest (e.g. Baking, Music)..."
            className="w-full px-3 py-2 text-xs bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] rounded-md text-[var(--sp-ink)]"
          />

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] rounded-md text-[var(--sp-ink)]"
          >
            {availableCountries.map((country) => (
              <option key={country} value={country}>
                {country === 'All' ? 'All Countries Worldwide' : country}
              </option>
            ))}
          </select>

          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] rounded-md text-[var(--sp-ink)]"
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang === 'All' ? 'All Languages' : `Speaks ${lang}`}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['All', ...DISCOVERY_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[var(--sp-primary)] text-white'
                    : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)] hover:text-[var(--sp-ink)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono-code text-[var(--sp-muted)] tabular-nums">
            {loadingDirectory
              ? 'Loading global directory...'
              : `${totalMatched.toLocaleString()} matching · Page ${page.toLocaleString()} of ${totalPages.toLocaleString()}`}
          </div>
        </div>
      </section>

      {displayedCards.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCards.map(({ person, match }) => {
              const sphereCategory = getEffectiveSphereId(person);
              const countryLabel =
                person.country || person.location.split(',').pop()?.trim() || 'Global';
              return (
                <article
                  key={person.id}
                  className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ page: 'profile', userId: person.id, tab: 'timeline' })
                        }
                        className="shrink-0 cursor-pointer"
                      >
                        <UserAvatar
                          user={person}
                          size="lg"
                          rounded="lg"
                          isOnline={onlineUserIds.includes(person.id)}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({ page: 'profile', userId: person.id, tab: 'timeline' })
                            }
                            className="font-display text-sm font-bold text-[var(--sp-ink)] hover:text-[var(--sp-primary-text)] hover:underline truncate cursor-pointer text-left"
                          >
                            {person.name}
                          </button>
                          <SphereIdBadge category={sphereCategory} onOpenSphereId={onOpenSphereId} />
                        </div>
                        <div className="text-xs text-[var(--sp-muted)] truncate">
                          {person.handle.startsWith('@') ? person.handle : `@${person.handle}`}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--sp-ink-2)]">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--sp-accent-text)]" />
                            <span>{countryLabel}</span>
                          </span>
                          {person.language && (
                            <span className="inline-flex items-center gap-1">
                              <Languages className="w-3 h-3 text-[var(--sp-primary-text)]" />
                              <span>{person.language}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed line-clamp-2">
                      {person.status}
                    </p>

                    <div className="p-2.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-1.5">
                      {match.allShared.length > 0 ? (
                        <>
                          <div className="text-[11px] font-bold text-[var(--sp-accent-text)]">
                            {match.allShared.length} shared{' '}
                            {match.allShared.length === 1 ? 'interest' : 'interests'}
                          </div>
                          <div className="text-[11px] text-[var(--sp-ink)] leading-snug">
                            {match.allShared.slice(0, 5).join(' · ')}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-[var(--sp-muted)]">
                          <strong>Focus:</strong> {person.interests.slice(0, 4).join(' · ')}
                        </div>
                      )}
                    </div>

                    {!hideCounts && (
                      <div className="text-[11px] text-[var(--sp-muted)] tabular-nums">
                        {person.friendCount} connections · {person.mutualFriends} mutual
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 bg-[var(--sp-surface-alt)] border-t border-[var(--sp-border-subtle)] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onToggleFriend(person.id)}
                      className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                        person.friendship === 'friends'
                          ? 'bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-ink)]'
                          : person.friendship === 'requested_outgoing'
                            ? 'bg-[var(--sp-primary-soft)] border border-[var(--sp-primary-soft-border)] text-[var(--sp-primary-text)]'
                            : 'bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white'
                      }`}
                    >
                      {person.friendship === 'friends' ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Connected</span>
                        </>
                      ) : person.friendship === 'requested_outgoing' ? (
                        <span>Requested</span>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Connect</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onMessageUser(person.id)}
                      className="py-2 px-3 bg-[var(--sp-accent-soft)] border border-[var(--sp-accent-soft-border)] text-[var(--sp-accent-text)] text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination bar for 100,000+ global directory */}
          <div className="p-4 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--sp-muted)] font-mono-code tabular-nums">
              Showing page {page.toLocaleString()} of {totalPages.toLocaleString()} ({totalGlobalPopulation.toLocaleString()} total members)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] text-xs font-semibold text-[var(--sp-ink)] disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setPage(1)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-code cursor-pointer ${
                  page === 1
                    ? 'bg-[var(--sp-primary)] text-white font-bold'
                    : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                }`}
              >
                1
              </button>
              {totalPages >= 100 && (
                <button
                  type="button"
                  onClick={() => setPage(100)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-code cursor-pointer ${
                    page === 100
                      ? 'bg-[var(--sp-primary)] text-white font-bold'
                      : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                  }`}
                >
                  100
                </button>
              )}
              {totalPages >= 1000 && (
                <button
                  type="button"
                  onClick={() => setPage(1000)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-code cursor-pointer ${
                    page === 1000
                      ? 'bg-[var(--sp-primary)] text-white font-bold'
                      : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                  }`}
                >
                  1,000
                </button>
              )}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] text-xs font-semibold text-[var(--sp-ink)] disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-8 text-center">
          <p className="text-sm font-semibold text-[var(--sp-ink)]">
            {loadingDirectory
              ? 'Searching 100,000+ global profiles...'
              : 'No Global Circle members match these filters yet.'}
          </p>
        </div>
      )}
    </div>
  );
};
