import React, { useState } from 'react';
import {
  Globe,
  Languages,
  Lock,
  MailCheck,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
} from 'lucide-react';
import { TOTAL_GLOBAL_DIRECTORY_COUNT } from '../utils/globalDirectory';
import { ImageWithFallback, SphereLogo } from './Media';

interface PublicLandingProps {
  totalGlobalPopulation?: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenGuidelines: () => void;
  onOpenRecovery?: () => void;
}

const ORBIT_RINGS = [
  {
    id: 'inner',
    label: 'Inner Circle',
    privacy: 'Friends Only',
    desc: 'Your confirmed friends in Labo, Daet, Manila, and beyond—sharing personal Echoes, Frames, and MySpace moments.',
  },
  {
    id: 'mutual',
    label: 'Extended Orbit',
    privacy: 'Friends of Friends',
    desc: 'Trusted mutual connections, local craft circles, and collaborators who share hobbies and skills.',
  },
  {
    id: 'spaces',
    label: 'Local & Civic Spaces',
    privacy: 'Pages & Circles',
    desc: 'Verified town updates, homegrown makers, and government-registered transparent Aid Drives.',
  },
  {
    id: 'vault',
    label: 'Private Vault',
    privacy: 'Only Me',
    desc: 'Personal reflections, private Frames, and draft ideas locked strictly to your own eyes under global privacy standards.',
  },
];

const GLOBAL_HUBS = [
  { region: 'Philippines', cities: 'Labo · Daet · Manila · Cebu', members: '20,000+' },
  { region: 'East Asia', cities: 'Tokyo · Seoul · Singapore', members: '15,000+' },
  { region: 'Americas', cities: 'San Francisco · New York · Vancouver · Mexico City · São Paulo', members: '25,000+' },
  { region: 'Europe, India & Africa', cities: 'London · Berlin · Madrid · Paris · Bengaluru · Lagos · Cape Town', members: '40,000+' },
];

export const PublicLanding: React.FC<PublicLandingProps> = ({
  totalGlobalPopulation = TOTAL_GLOBAL_DIRECTORY_COUNT,
  theme,
  onToggleTheme,
  onOpenSignIn,
  onOpenSignUp,
  onOpenGuidelines,
  onOpenRecovery,
}) => {
  const [selectedRing, setSelectedRing] = useState(ORBIT_RINGS[0]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--sp-bg)] text-[var(--sp-ink)]">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[var(--sp-header-bg)] border-b border-[var(--sp-header-border)] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a href="#top" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <SphereLogo size={32} tone="white" />
            <span className="font-display text-2xl font-extrabold tracking-tight">
              Sphere<span className="text-[#22D3EE]">.</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/85">
            <a href="#orbits" className="hover:text-white hover:underline whitespace-nowrap shrink-0">
              Concentric Orbits
            </a>
            <a href="#global" className="hover:text-white hover:underline whitespace-nowrap shrink-0">
              Global Community
            </a>
            <a href="#pillars" className="hover:text-white hover:underline whitespace-nowrap shrink-0">
              Why Sphere
            </a>
            <button
              type="button"
              onClick={onOpenGuidelines}
              className="hover:text-white hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Policy Guidelines
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle light or dark mode"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenSignIn}
              className="px-4 py-2 rounded-lg bg-[#06B6D4] hover:bg-[#22D3EE] text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
            <div className="text-xs font-mono-code font-semibold text-[var(--sp-accent-text)] uppercase tracking-wider">
              {totalGlobalPopulation.toLocaleString()}+ Global Members · Verified Entry Only
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--sp-ink)] leading-[1.1] [text-wrap:balance]">
              Social connection built around real circles, not noisy algorithms.
            </h1>
            <p className="text-base text-[var(--sp-ink-2)] leading-relaxed max-w-xl">
              Connect with {totalGlobalPopulation.toLocaleString()}+ makers, travelers, families, and builders across 20+ countries. Protect your MySpace wall under global privacy laws and verify your identity via real Email or Phone SMS OTP before entering.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onOpenSignUp}
                className="px-6 py-3 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-sm font-bold whitespace-nowrap cursor-pointer"
              >
                Create Account (18+)
              </button>
              <button
                type="button"
                onClick={onOpenSignIn}
                className="px-6 py-3 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-[var(--sp-ink)] text-sm font-bold whitespace-nowrap cursor-pointer"
              >
                Sign In to Your Account
              </button>
              {onOpenRecovery && (
                <button
                  type="button"
                  onClick={onOpenRecovery}
                  className="px-4 py-3 rounded-xl border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-[var(--sp-primary-text)] text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Account Recovery Center
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[var(--sp-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[var(--sp-accent-text)]" />
                Real Phone SMS OTP
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MailCheck className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
                Real Email Verification
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                Zero Shared Sessions
              </span>
            </div>

            <div className="text-xs text-[var(--sp-muted)]">
              Members must be 18+ years old. Parents and guardians are advised to supervise minors.{' '}
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="text-[var(--sp-primary-text)] font-semibold hover:underline cursor-pointer"
              >
                Read Sphere Policy Guidelines
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] rounded-2xl overflow-hidden border border-[var(--sp-border)] bg-[var(--sp-surface)] shadow-sm flex flex-col">
              <div className="relative flex-1 min-h-[240px]">
                <ImageWithFallback
                  src="/media-seed/sphere_hero_community_1794746490268.jpg"
                  alt="Local creatives, bakers, and designers gathered around an outdoor table"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent flex items-end p-5">
                  <div className="text-white space-y-1">
                    <div className="text-xs font-mono-code text-[#A5F3FC]">
                      Global Directory · {totalGlobalPopulation.toLocaleString()} Profiles Worldwide
                    </div>
                    <div className="font-display text-lg font-bold">
                      Real neighbors, homegrown kitchens, and independent studios across every timezone.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Global Directory Preview (No account credentials or saved sessions exposed) */}
        <section id="global" className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
          <div className="p-6 rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)] flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[var(--sp-accent-text)]" />
                  <span>{totalGlobalPopulation.toLocaleString()}+ Global Profiles Await Inside</span>
                </h2>
                <p className="text-xs text-[var(--sp-muted)] mt-0.5">
                  Sign up and verify your email or phone number to browse full profiles, find shared hobbies, and message members worldwide.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenSignUp}
                className="px-4 py-2 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                Join Community
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {GLOBAL_HUBS.map((hub) => (
                <div
                  key={hub.region}
                  className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-[var(--sp-ink)]">
                      {hub.region}
                    </span>
                    <span className="text-xs font-mono-code font-bold text-[var(--sp-accent-text)]">
                      {hub.members}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--sp-muted)] leading-relaxed">{hub.cities}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive 4-Ring Orbit Explainer */}
        <section id="orbits" className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--sp-surface)] border border-[var(--sp-border)] grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-mono-code font-semibold text-[var(--sp-primary-text)] uppercase">
                How Sphere. Organizes Trust
              </div>
              <h2 className="font-display text-2xl font-extrabold text-[var(--sp-ink)]">
                Four concentric rings keep every post in the right hands.
              </h2>
              <p className="text-sm text-[var(--sp-ink-2)] leading-relaxed">
                Every Echo, Image, Frame, and MySpace post carries its own audience lock—never leaking personal life into public feeds.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {ORBIT_RINGS.map((ring) => (
                  <button
                    key={ring.id}
                    type="button"
                    onClick={() => setSelectedRing(ring)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                      selectedRing.id === ring.id
                        ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)] text-[var(--sp-ink)]'
                        : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border-subtle)] text-[var(--sp-ink-2)] hover:border-[var(--sp-border)]'
                    }`}
                  >
                    <div className="text-xs font-bold">{ring.label}</div>
                    <div className="text-[11px] text-[var(--sp-muted)]">{ring.privacy}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 p-6 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold text-[var(--sp-ink)]">
                  {selectedRing.label}
                </span>
                <span className="text-xs font-mono-code font-semibold text-[var(--sp-accent-text)]">
                  {selectedRing.privacy}
                </span>
              </div>
              <p className="text-sm text-[var(--sp-ink-2)] leading-relaxed">{selectedRing.desc}</p>
              <div className="grid grid-cols-4 gap-2 pt-2 text-center text-[11px] text-[var(--sp-muted)]">
                <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                  <strong className="block text-[var(--sp-ink)]">Pulse</strong>
                  Scoped feed
                </div>
                <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                  <strong className="block text-[var(--sp-ink)]">MySpace</strong>
                  Tag approval
                </div>
                <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                  <strong className="block text-[var(--sp-ink)]">Frames</strong>
                  Album locks
                </div>
                <div className="p-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border-subtle)]">
                  <strong className="block text-[var(--sp-ink)]">Loops</strong>
                  Max 3 min
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Pillars */}
        <section id="pillars" className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] space-y-2">
              <Languages className="w-5 h-5 text-[var(--sp-accent-text)]" />
              <h3 className="font-display text-base font-bold text-[var(--sp-ink)]">
                01. Universal Language
              </h3>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                Read Tagalog, English, Japanese, Spanish, or Korean updates in your preferred language with one click.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] space-y-2">
              <Lock className="w-5 h-5 text-[var(--sp-primary-text)]" />
              <h3 className="font-display text-base font-bold text-[var(--sp-ink)]">
                02. Global Privacy Laws
              </h3>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                Honors RA 10173, GDPR, CCPA, APPI, and global data privacy rules with tag &amp; MySpace wall approvals.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] space-y-2">
              <Users className="w-5 h-5 text-[var(--sp-accent-text)]" />
              <h3 className="font-display text-base font-bold text-[var(--sp-ink)]">
                03. Local Shelves &amp; Pages
              </h3>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                Support homegrown enterprises, municipal advisories, and independent studios worldwide.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-[var(--sp-surface)] border border-[var(--sp-border)] space-y-2">
              <Globe className="w-5 h-5 text-[var(--sp-primary-text)]" />
              <h3 className="font-display text-base font-bold text-[var(--sp-ink)]">
                04. Verified Aid Drives
              </h3>
              <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
                Only government-registered organizations with verified credentials can host transparent Aid Drives.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--sp-border)] bg-[var(--sp-surface)] py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--sp-muted)]">
          <div>
            © 2026 Sphere. · 18+ Community · Parents and guardians are advised to supervise minors.
          </div>
          <div className="flex items-center gap-4">
            {onOpenRecovery && (
              <button
                type="button"
                onClick={onOpenRecovery}
                className="font-semibold text-[var(--sp-ink)] hover:underline cursor-pointer"
              >
                Account Recovery Center
              </button>
            )}
            <button
              type="button"
              onClick={onOpenGuidelines}
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sphere Policy Guidelines</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
