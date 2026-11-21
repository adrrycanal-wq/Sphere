import React, { useMemo, useState } from 'react';
import { Compass, MessageCircle, Shield, Users } from 'lucide-react';
import { GroupItem, NavRoute, PageItem, UserProfile } from '../types/social';
import { UserAvatar } from './Media';

interface OrbitMapProps {
  currentUser: UserProfile;
  users: UserProfile[];
  pages: PageItem[];
  groups: GroupItem[];
  onlineUserIds: string[];
  onNavigate: (route: NavRoute) => void;
  onMessageUser: (userId: string) => void;
}

type SelectedOrbitNode =
  | { kind: 'user'; user: UserProfile; ring: string }
  | { kind: 'page'; page: PageItem }
  | { kind: 'group'; group: GroupItem }
  | null;

export const OrbitMap: React.FC<OrbitMapProps> = ({
  currentUser,
  users,
  pages,
  groups,
  onlineUserIds,
  onNavigate,
  onMessageUser,
}) => {
  const innerCircle = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && u.friendship === 'friends'),
    [users, currentUser.id]
  );
  const extendedOrbit = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && u.friendship !== 'friends').slice(0, 6),
    [users, currentUser.id]
  );
  const spaces = useMemo(() => {
    const p = pages.filter((pg) => pg.following).slice(0, 3);
    const g = groups.filter((gr) => gr.joined).slice(0, 3);
    return { pages: p, groups: g };
  }, [pages, groups]);

  const [selected, setSelected] = useState<SelectedOrbitNode>(
    innerCircle[0] ? { kind: 'user', user: innerCircle[0], ring: 'Inner Circle' } : null
  );

  return (
    <div className="bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-xs font-mono-code font-semibold text-[var(--sp-accent-text)] uppercase">
            Concentric Orbit Map
          </div>
          <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
            Your Sphere. at a Glance
          </h2>
          <p className="text-xs text-[var(--sp-muted)]">
            Click any person, Page, or Circle around your center node to inspect privacy ring and jump straight in.
          </p>
        </div>
        <div className="text-xs text-[var(--sp-ink-2)] font-mono-code tabular-nums">
          {innerCircle.length} Inner · {extendedOrbit.length} Orbit ·{' '}
          {spaces.pages.length + spaces.groups.length} Spaces
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Interactive Spatial Rings */}
        <div className="lg:col-span-7 relative rounded-2xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] p-5 min-h-[380px] flex flex-col justify-between gap-4 overflow-hidden">
          {/* Ring 3: Spaces */}
          <div className="rounded-2xl border border-dashed border-[var(--sp-accent-soft-border)] p-3.5 space-y-2.5">
            <div className="text-[11px] font-mono-code font-semibold text-[var(--sp-accent-text)] flex items-center justify-between">
              <span>Ring 03 · Followed Pages &amp; Joined Circles</span>
              <span>{spaces.pages.length + spaces.groups.length} active</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {spaces.pages.map((pg) => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => setSelected({ kind: 'page', page: pg })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                    selected?.kind === 'page' && selected.page.id === pg.id
                      ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)]'
                      : 'bg-[var(--sp-surface)] border-[var(--sp-border)] text-[var(--sp-ink)] hover:border-[var(--sp-primary)]'
                  }`}
                >
                  {pg.name}
                </button>
              ))}
              {spaces.groups.map((gr) => (
                <button
                  key={gr.id}
                  type="button"
                  onClick={() => setSelected({ kind: 'group', group: gr })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                    selected?.kind === 'group' && selected.group.id === gr.id
                      ? 'bg-[#06B6D4] text-slate-950 border-[#06B6D4]'
                      : 'bg-[var(--sp-surface)] border-[var(--sp-border)] text-[var(--sp-ink)] hover:border-[#06B6D4]'
                  }`}
                >
                  {gr.name}
                </button>
              ))}
            </div>

            {/* Ring 2: Extended Orbit */}
            <div className="rounded-2xl border border-[var(--sp-primary-soft-border)] bg-[var(--sp-surface)]/70 p-3.5 space-y-2.5">
              <div className="text-[11px] font-mono-code font-semibold text-[var(--sp-primary-text)]">
                Ring 02 · Extended Orbit (People You May Know &amp; Global Circle)
              </div>
              <div className="flex flex-wrap gap-2">
                {extendedOrbit.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelected({ kind: 'user', user: u, ring: 'Extended Orbit' })}
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                      selected?.kind === 'user' && selected.user.id === u.id
                        ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)] font-bold'
                        : 'bg-[var(--sp-surface)] border-[var(--sp-border)] hover:border-[var(--sp-primary)]'
                    }`}
                  >
                    <UserAvatar user={u} size="xs" isOnline={onlineUserIds.includes(u.id)} />
                    <span className="text-[var(--sp-ink)]">{u.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {/* Ring 1: Inner Circle & You */}
              <div className="rounded-2xl border-2 border-[var(--sp-primary)] bg-[var(--sp-surface)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar user={currentUser} size="md" isOnline />
                    <div>
                      <div className="text-xs font-bold text-[var(--sp-ink)]">
                        Center · {currentUser.name}
                      </div>
                      <div className="text-[11px] text-[var(--sp-muted)]">
                        {currentUser.location} · Privacy: {currentUser.privacy.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-[var(--sp-ink-2)]">
                  Ring 01 · Inner Circle ({innerCircle.length} confirmed friends)
                </div>
                <div className="flex flex-wrap gap-2">
                  {innerCircle.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelected({ kind: 'user', user: u, ring: 'Inner Circle' })}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                        selected?.kind === 'user' && selected.user.id === u.id
                          ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)] font-bold'
                          : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)] text-[var(--sp-ink)] hover:border-[var(--sp-primary)]'
                      }`}
                    >
                      <UserAvatar user={u} size="xs" isOnline={onlineUserIds.includes(u.id)} />
                      <span>{u.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="lg:col-span-5 rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface-alt)] p-5 space-y-4">
          {selected?.kind === 'user' ? (
            <>
              <div className="flex items-center gap-3">
                <UserAvatar
                  user={selected.user}
                  size="xl"
                  isOnline={onlineUserIds.includes(selected.user.id)}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-mono-code font-semibold text-[var(--sp-accent-text)]">
                    {selected.ring}
                  </div>
                  <h3 className="font-display text-base font-extrabold text-[var(--sp-ink)] truncate">
                    {selected.user.name}
                  </h3>
                  <div className="text-xs text-[var(--sp-muted)]">{selected.user.location}</div>
                </div>
              </div>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                “{selected.user.status}”
              </p>
              <div className="text-xs text-[var(--sp-muted)] space-y-1">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
                  <span>Account visibility: {selected.user.privacy.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[var(--sp-accent-text)]" />
                  <span>Interests: {selected.user.interests.slice(0, 4).join(' · ')}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({ page: 'profile', userId: selected.user.id, tab: 'timeline' })
                  }
                  className="flex-1 py-2 px-3 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-semibold cursor-pointer"
                >
                  Open MySpace Profile
                </button>
                <button
                  type="button"
                  onClick={() => onMessageUser(selected.user.id)}
                  className="py-2 px-3 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] text-[var(--sp-ink)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
              </div>
            </>
          ) : selected?.kind === 'page' ? (
            <>
              <div className="text-[11px] font-mono-code font-semibold text-[var(--sp-primary-text)]">
                Followed Page · {selected.page.category}
              </div>
              <h3 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
                {selected.page.name}
              </h3>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                {selected.page.description}
              </p>
              <button
                type="button"
                onClick={() =>
                  onNavigate({ page: 'discover', tab: 'pages', pageId: selected.page.id })
                }
                className="w-full py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer"
              >
                Visit Page →
              </button>
            </>
          ) : selected?.kind === 'group' ? (
            <>
              <div className="text-[11px] font-mono-code font-semibold text-[var(--sp-accent-text)]">
                Joined Circle · {selected.group.category}
              </div>
              <h3 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
                {selected.group.name}
              </h3>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                {selected.group.description}
              </p>
              <div className="text-xs text-[var(--sp-muted)] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{selected.group.totalMembers} members</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onNavigate({ page: 'discover', tab: 'groups', groupId: selected.group.id })
                }
                className="w-full py-2 rounded-lg bg-[#06B6D4] text-slate-950 text-xs font-bold cursor-pointer"
              >
                Open Circle →
              </button>
            </>
          ) : (
            <p className="text-xs text-[var(--sp-muted)]">
              Select any node on the Orbit Map to inspect details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
