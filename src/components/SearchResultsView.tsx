import React, { useMemo, useState } from 'react';
import { Bookmark, Globe, Image as ImageIcon, Layers, Search, Users } from 'lucide-react';
import {
  GroupItem,
  NavRoute,
  PageItem,
  PhotoItem,
  SocialPost,
  UserProfile,
} from '../types/social';
import { ImageWithFallback, UserAvatar } from './Media';

interface SearchResultsViewProps {
  query: string;
  initialFilter?: 'all' | 'people' | 'pages' | 'posts' | 'groups' | 'photos';
  users: UserProfile[];
  pages: PageItem[];
  posts: SocialPost[];
  groups: GroupItem[];
  photos: PhotoItem[];
  onNavigate: (route: NavRoute) => void;
  onOpenPhoto: (photoId: string) => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  query,
  initialFilter = 'all',
  users,
  pages,
  posts,
  groups,
  photos,
  onNavigate,
  onOpenPhoto,
}) => {
  const [filter, setFilter] = useState<'all' | 'people' | 'pages' | 'posts' | 'groups' | 'photos'>(
    initialFilter
  );

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    return {
      people: users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          u.location.toLowerCase().includes(q) ||
          u.interests.some((i) => i.toLowerCase().includes(q))
      ),
      pages: pages.filter(
        (pg) =>
          pg.name.toLowerCase().includes(q) ||
          pg.category.toLowerCase().includes(q) ||
          pg.description.toLowerCase().includes(q)
      ),
      posts: posts.filter(
        (p) =>
          p.content.toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q)
      ),
      groups: groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q)
      ),
      photos: photos.filter(
        (ph) =>
          ph.caption.toLowerCase().includes(q) ||
          ph.location.toLowerCase().includes(q) ||
          ph.album.toLowerCase().includes(q)
      ),
    };
  }, [q, users, pages, posts, groups, photos]);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-[var(--sp-primary-text)]" />
          <h1 className="font-display text-xl font-extrabold text-[var(--sp-ink)]">
            Search Results for “{query}”
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'people', label: `People (${matches.people.length})` },
              { id: 'pages', label: `Pages (${matches.pages.length})` },
              { id: 'posts', label: `Posts (${matches.posts.length})` },
              { id: 'groups', label: `Circles (${matches.groups.length})` },
              { id: 'photos', label: `Images (${matches.photos.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                filter === tab.id
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {(filter === 'all' || filter === 'people') && matches.people.length > 0 && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[var(--sp-primary-text)]" />
            <span>People</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.people.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onNavigate({ page: 'profile', userId: u.id, tab: 'timeline' })}
                className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] hover:border-[var(--sp-primary)] flex items-center gap-3 text-left cursor-pointer"
              >
                <UserAvatar user={u} size="md" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--sp-ink)] truncate">{u.name}</div>
                  <div className="text-[11px] text-[var(--sp-muted)] truncate">{u.location}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(filter === 'all' || filter === 'pages') && matches.pages.length > 0 && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-[var(--sp-accent-text)]" />
            <span>Pages</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.pages.map((pg) => (
              <button
                key={pg.id}
                type="button"
                onClick={() => onNavigate({ page: 'discover', tab: 'pages', pageId: pg.id })}
                className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] hover:border-[var(--sp-primary)] flex items-center gap-3 text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <ImageWithFallback
                    src={pg.avatar || pg.coverImage}
                    alt={pg.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--sp-ink)] truncate">{pg.name}</div>
                  <div className="text-[11px] text-[var(--sp-muted)] truncate">
                    {pg.category} · {pg.location}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(filter === 'all' || filter === 'groups') && matches.groups.length > 0 && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[var(--sp-primary-text)]" />
            <span>Circles</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.groups.map((gr) => (
              <button
                key={gr.id}
                type="button"
                onClick={() => onNavigate({ page: 'discover', tab: 'groups', groupId: gr.id })}
                className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] hover:border-[var(--sp-primary)] text-left cursor-pointer"
              >
                <div className="text-xs font-bold text-[var(--sp-ink)]">{gr.name}</div>
                <div className="text-[11px] text-[var(--sp-muted)]">{gr.category} · {gr.totalMembers} members</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(filter === 'all' || filter === 'posts') && matches.posts.length > 0 && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[var(--sp-primary-text)]" />
            <span>Posts</span>
          </div>
          <div className="space-y-2">
            {matches.posts.map((p) => {
              const author = users.find((u) => u.id === p.authorId);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onNavigate({ page: 'home', hashtag: p.content.match(/#[A-Za-z0-9_]+/)?.[0] })}
                  className="w-full p-3 rounded-xl bg-[var(--sp-surface-alt)] text-left text-xs space-y-1 cursor-pointer hover:border-[var(--sp-primary)] border border-[var(--sp-border-subtle)]"
                >
                  <div className="font-bold text-[var(--sp-ink)]">{author?.name}</div>
                  <p className="text-[var(--sp-ink-2)] line-clamp-2">{p.content}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(filter === 'all' || filter === 'photos') && matches.photos.length > 0 && (
        <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-[var(--sp-accent-text)]" />
            <span>Images</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {matches.photos.map((ph) => (
              <button
                key={ph.id}
                type="button"
                onClick={() => onOpenPhoto(ph.id)}
                className="aspect-square rounded-xl overflow-hidden border border-[var(--sp-border)] cursor-pointer"
              >
                <ImageWithFallback
                  src={ph.src}
                  alt={ph.caption}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
