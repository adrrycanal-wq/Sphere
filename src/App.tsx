import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Compass,
  Globe,
  HeartHandshake,
  Home,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Moon,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sun,
  User,
  Users,
} from 'lucide-react';
import {
  isFirebaseUserVerified,
  refreshCurrentFirebaseUser,
  resendVerificationEmailForCurrentUser,
  signOutFirebase,
  subscribeFirebaseAuth,
} from './firebase';
import {
  AttachmentItem,
  BootstrapPayload,
  NavRoute,
  SocialPost,
  UserProfile,
} from './types/social';
import {
  apiMarkNotificationsRead,
  apiMarkThreadRead,
  apiOpenThread,
  apiReactMessage,
  apiSendMessage,
  apiSyncFirebaseSession,
  apiToggleFriend,
  apiUpdateThreadSettings,
  apiUpdateUser,
  apiUploadFile,
  clearSphereSessionToken,
  fetchBootstrap,
  isStaticHostingMode,
} from './utils/api';
import { TOTAL_GLOBAL_DIRECTORY_COUNT, getVirtualUserById } from './utils/globalDirectory';
import { SignInModal, SignUpModal } from './components/AuthGate';
import { ActiveCallSession, IncomingCallToast } from './components/CallStageModal';
import { FeedView } from './components/FeedView';
import { FloatingMessenger, playMessengerChime } from './components/FloatingMessenger';
import { CreateGroupChatModal, GroupSettingsModal } from './components/GroupChatModal';
import { useImageViewer } from './components/ImageViewerContext';
import { SphereLogo, UserAvatar } from './components/Media';
import { PhotoManagerModal } from './components/PhotoManagerModal';
import { PolicyGuidelinesModal } from './components/PolicyGuidelinesModal';
import { PublicLanding } from './components/PublicLanding';
import {
  EditProfileModal,
  PhotoLightboxModal,
  SharePostModal,
  SphereIdModal,
} from './components/SocialModals';

const AdsDashboardView = lazy(() =>
  import('./components/AdsDashboardView').then((m) => ({ default: m.AdsDashboardView }))
);
const AnonymousView = lazy(() =>
  import('./components/AnonymousView').then((m) => ({ default: m.AnonymousView }))
);
const CallStageModal = lazy(() =>
  import('./components/CallStageModal').then((m) => ({ default: m.CallStageModal }))
);
const DiscoverHubView = lazy(() =>
  import('./components/DiscoverHubView').then((m) => ({ default: m.DiscoverHubView }))
);
const DonationDrivesView = lazy(() =>
  import('./components/DonationDrivesView').then((m) => ({ default: m.DonationDrivesView }))
);
const GlobalCircleView = lazy(() =>
  import('./components/GlobalCircleView').then((m) => ({ default: m.GlobalCircleView }))
);
const LiveStreamModal = lazy(() =>
  import('./components/LiveStreamModal').then((m) => ({ default: m.LiveStreamModal }))
);
const MessagesView = lazy(() =>
  import('./components/MessagesView').then((m) => ({ default: m.MessagesView }))
);
const PrivacyControlsView = lazy(() =>
  import('./components/PrivacyControlsView').then((m) => ({ default: m.PrivacyControlsView }))
);
const ProfileView = lazy(() =>
  import('./components/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const SearchResultsView = lazy(() =>
  import('./components/SearchResultsView').then((m) => ({ default: m.SearchResultsView }))
);
const AccountRecoveryCenterView = lazy(() =>
  import('./components/AccountRecoveryCenterView').then((m) => ({
    default: m.AccountRecoveryCenterView,
  }))
);
const AccountSecuritySettingsView = lazy(() =>
  import('./components/AccountSecuritySettingsView').then((m) => ({
    default: m.AccountSecuritySettingsView,
  }))
);
const VerificationSecurityDashboardsView = lazy(() =>
  import('./components/VerificationSecurityDashboardsView').then((m) => ({
    default: m.VerificationSecurityDashboardsView,
  }))
);

const STORAGE_USER_KEY = 'sphere_active_user_id';
const STORAGE_THEME_KEY = 'sphere_theme';
const SESSION_OPEN_THREADS_KEY = 'sphere_open_threads';
const SESSION_MIN_THREADS_KEY = 'sphere_min_threads';
const SESSION_SOUND_KEY = 'sphere_chat_sound';

function readJsonStorage<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const { activeMedia, openImage, closeImage } = useImageViewer();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [authGateMsg, setAuthGateMsg] = useState<string | null>(null);

  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<NavRoute>({ page: 'home', viewMode: 'pulse' });

  // Search bar
  const [searchInput, setSearchInput] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Header dropdowns
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Auth modals, logged-out Recovery Center & Policy Guidelines modal
  const [signInOpen, setSignInOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [initialRecoveryToken] = useState<string>(() => {
    try {
      return new URLSearchParams(window.location.search).get('recoveryToken') || '';
    } catch {
      return '';
    }
  });
  const [loggedOutRecoveryOpen, setLoggedOutRecoveryOpen] = useState<boolean>(() => {
    try {
      return Boolean(new URLSearchParams(window.location.search).get('recoveryToken'));
    } catch {
      return false;
    }
  });

  // Feature modals
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<SocialPost | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [sphereIdOpen, setSphereIdOpen] = useState(false);
  const [photoManagerMode, setPhotoManagerMode] = useState<'avatar' | 'cover' | null>(null);
  const [liveModalState, setLiveModalState] = useState<{
    open: boolean;
    post?: SocialPost | null;
  }>({ open: false, post: null });
  const [boostPostId, setBoostPostId] = useState<string | undefined>(undefined);

  // Floating Messenger dock state (persisted in sessionStorage)
  const [openThreadIds, setOpenThreadIds] = useState<string[]>(() =>
    readJsonStorage(sessionStorage, SESSION_OPEN_THREADS_KEY, [])
  );
  const [minimizedThreadIds, setMinimizedThreadIds] = useState<string[]>(() =>
    readJsonStorage(sessionStorage, SESSION_MIN_THREADS_KEY, [])
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const raw = sessionStorage.getItem(SESSION_SOUND_KEY);
    return raw === null ? true : raw === 'true';
  });

  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingByThread, setTypingByThread] = useState<Record<string, string[]>>({});
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupSettingsThreadId, setGroupSettingsThreadId] = useState<string | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<ActiveCallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    threadId: string;
    fromUserId: string;
    mode: 'video' | 'screen';
    offer: RTCSessionDescriptionInit;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  }, [theme]);

  // Persist Floating Messenger dock in sessionStorage
  useEffect(() => {
    sessionStorage.setItem(SESSION_OPEN_THREADS_KEY, JSON.stringify(openThreadIds));
  }, [openThreadIds]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_MIN_THREADS_KEY, JSON.stringify(minimizedThreadIds));
  }, [minimizedThreadIds]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_SOUND_KEY, String(soundEnabled));
  }, [soundEnabled]);

  const loadBootstrap = useCallback(async (viewerId?: string | null) => {
    try {
      const payload = await fetchBootstrap(viewerId || undefined);
      setData(payload);
      setOnlineUserIds(payload.onlineUserIds || []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real Firebase Authentication state observer (always logged out on incognito/new browser)
  useEffect(() => {
    localStorage.removeItem(STORAGE_USER_KEY);
    const unsub = subscribeFirebaseAuth(async (fbUser) => {
      if (!fbUser) {
        setCurrentUserId(null);
        setUnverifiedEmail(null);
        setAuthReady(true);
        return;
      }

      if (!isFirebaseUserVerified(fbUser)) {
        setUnverifiedEmail(fbUser.email || 'your email');
        setCurrentUserId(null);
        setAuthReady(true);
        return;
      }

      setUnverifiedEmail(null);
      if (!currentUserIdRef.current) {
        try {
          const res = await apiSyncFirebaseSession({
            uid: fbUser.uid,
            email: fbUser.email,
            phoneNumber: fbUser.phoneNumber,
            displayName: fbUser.displayName,
            emailVerified: fbUser.emailVerified,
          });
          if (res.user) {
            setCurrentUserId(res.user.id);
          }
        } catch {
          setCurrentUserId(null);
        }
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void loadBootstrap(currentUserId);
  }, [authReady, currentUserId, loadBootstrap]);

  // Real-time WebSocket connection (/ws)
  useEffect(() => {
    if (!currentUserId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let closed = false;
    let openedOnce = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (closed || isStaticHostingMode()) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        openedOnce = true;
        ws.send(JSON.stringify({ type: 'auth', userId: currentUserId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === 'presence' && msg.payload?.onlineUserIds) {
            setOnlineUserIds(msg.payload.onlineUserIds);
          } else if (msg.type === 'typing' && msg.payload?.threadId) {
            const { threadId, userId, isTyping } = msg.payload as {
              threadId: string;
              userId: string;
              isTyping: boolean;
            };
            setTypingByThread((prev) => {
              const curr = prev[threadId] || [];
              const next = isTyping
                ? Array.from(new Set([...curr, userId]))
                : curr.filter((id) => id !== userId);
              return { ...prev, [threadId]: next };
            });
          } else if (msg.type === 'message:new') {
            const { senderId } = (msg.payload || {}) as { senderId?: string };
            if (
              soundEnabledRef.current &&
              senderId &&
              senderId !== currentUserIdRef.current
            ) {
              playMessengerChime();
            }
            void loadBootstrap(currentUserIdRef.current);
          } else if (msg.type === 'call:invite' && msg.payload?.threadId && msg.payload?.offer) {
            const payload = msg.payload as {
              threadId: string;
              fromUserId: string;
              mode: 'video' | 'screen';
              offer: RTCSessionDescriptionInit;
            };
            if (payload.fromUserId && payload.fromUserId !== currentUserIdRef.current) {
              setIncomingCall({
                threadId: payload.threadId,
                fromUserId: payload.fromUserId,
                mode: payload.mode === 'screen' ? 'screen' : 'video',
                offer: payload.offer,
              });
              if (soundEnabledRef.current) {
                playMessengerChime();
              }
            }
          } else if (msg.type === 'call:decline' || msg.type === 'call:end') {
            const payload = (msg.payload || {}) as { threadId?: string };
            setIncomingCall((prev) =>
              prev && payload.threadId && prev.threadId === payload.threadId ? null : prev
            );
          } else if (
            [
              'message:read',
              'message:react',
              'thread:updated',
              'post:new',
              'post:updated',
              'post:deleted',
              'livestream:chat',
              'donation:created',
              'donation:updated',
              'notification:new',
            ].includes(msg.type)
          ) {
            void loadBootstrap(currentUserIdRef.current);
          }
        } catch {
          // Ignore malformed WS events
        }
      };

      ws.onclose = () => {
        if (!closed && openedOnce && !isStaticHostingMode()) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    if (!isStaticHostingMode()) {
      connect();
    }

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [currentUserId, loadBootstrap]);

  const currentUser = useMemo(() => {
    if (!data || !currentUserId) return null;
    return data.users.find((u) => u.id === currentUserId) || null;
  }, [data, currentUserId]);

  const handleAuthenticated = (user: UserProfile) => {
    setUnverifiedEmail(null);
    setCurrentUserId(user.id);
    setRoute({ page: 'home', viewMode: 'pulse' });
    setSignInOpen(false);
    setSignUpOpen(false);
  };

  const handleLogout = async () => {
    await signOutFirebase().catch(() => {});
    clearSphereSessionToken();
    localStorage.removeItem(STORAGE_USER_KEY);
    sessionStorage.removeItem(SESSION_OPEN_THREADS_KEY);
    sessionStorage.removeItem(SESSION_MIN_THREADS_KEY);
    setCurrentUserId(null);
    setUnverifiedEmail(null);
    setOpenThreadIds([]);
    setMinimizedThreadIds([]);
    setAccountMenuOpen(false);
    setNotifOpen(false);
  };

  const openChatWithUser = async (targetUserId: string) => {
    if (!currentUser) return;
    const { thread } = await apiOpenThread([currentUser.id, targetUserId]);
    await loadBootstrap(currentUser.id);
    setOpenThreadIds((prev) => Array.from(new Set([...prev, thread.id])));
    setMinimizedThreadIds((prev) => prev.filter((id) => id !== thread.id));
  };

  const handleSendInMessenger = async (targetUserId: string, post: SocialPost) => {
    if (!currentUser) return;
    const { thread } = await apiOpenThread([currentUser.id, targetUserId]);
    await apiSendMessage(thread.id, {
      senderId: currentUser.id,
      text: `Shared a post on Sphere.: "${post.content.slice(0, 120)}${
        post.content.length > 120 ? '...' : ''
      }"`,
      sharedPostId: post.id,
    });
    await loadBootstrap(currentUser.id);
    setOpenThreadIds((prev) => Array.from(new Set([...prev, thread.id])));
    setMinimizedThreadIds((prev) => prev.filter((id) => id !== thread.id));
  };

  const handleOpenThread = (threadId: string) => {
    setOpenThreadIds((prev) => Array.from(new Set([...prev, threadId])));
    setMinimizedThreadIds((prev) => prev.filter((id) => id !== threadId));
    if (currentUser) {
      void apiMarkThreadRead(threadId, currentUser.id).then(() => loadBootstrap(currentUser.id));
    }
  };

  const handleMinimizeThread = (threadId: string) => {
    setOpenThreadIds((prev) => prev.filter((id) => id !== threadId));
    setMinimizedThreadIds((prev) => Array.from(new Set([...prev, threadId])));
  };

  const handleCloseThread = (threadId: string) => {
    setOpenThreadIds((prev) => prev.filter((id) => id !== threadId));
    setMinimizedThreadIds((prev) => prev.filter((id) => id !== threadId));
  };

  const handleTypingChange = (threadId: string, isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentUser) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          threadId,
          userId: currentUser.id,
          isTyping,
        })
      );
    }
  };

  const handleStartCall = (threadId: string, mode: 'video' | 'screen') => {
    setIncomingCall(null);
    setActiveCallSession({ threadId, mode });
  };

  const handleReplaceGroupLogo = async (threadId: string, file: File) => {
    if (!currentUser) return;
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
    const uploaded = await apiUploadFile({
      fileName: file.name,
      mimeType: file.type,
      dataBase64,
    });
    await apiUpdateThreadSettings(threadId, {
      userId: currentUser.id,
      avatar: uploaded.url,
    });
    await loadBootstrap(currentUser.id);
  };

  const handleSendSnapshotToChat = async (threadId: string, dataUrl: string) => {
    if (!currentUser) return;
    const uploaded = await apiUploadFile({
      fileName: `call-snapshot-${Date.now()}.png`,
      mimeType: 'image/png',
      dataBase64: dataUrl,
    });
    await apiSendMessage(threadId, {
      senderId: currentUser.id,
      text: '📸 Filtered call snapshot',
      attachments: [
        {
          id: `att-snap-${Date.now()}`,
          name: uploaded.name,
          url: uploaded.url,
          mimeType: 'image/png',
          sizeBytes: uploaded.sizeBytes,
          kind: 'image',
        },
      ],
    });
    await loadBootstrap(currentUser.id);
  };

  const totalUnreadChats = useMemo(() => {
    if (!data || !currentUser) return 0;
    return data.threads.reduce((acc, t) => {
      const unread = t.messages.filter(
        (m) => m.senderId !== currentUser.id && !(m.readBy || []).includes(currentUser.id)
      ).length;
      return acc + unread;
    }, 0);
  }, [data, currentUser]);

  const unreadNotifs = useMemo(
    () => (data?.notifications || []).filter((n) => !n.read),
    [data?.notifications]
  );

  const liveSearchDropdown = useMemo(() => {
    if (!data || !searchInput.trim()) return { people: [], pages: [] };
    const q = searchInput.trim().toLowerCase();
    return {
      people: data.users
        .filter((u) => u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q))
        .slice(0, 4),
      pages: data.pages
        .filter((pg) => pg.name.toLowerCase().includes(q) || pg.category.toLowerCase().includes(q))
        .slice(0, 3),
    };
  }, [data, searchInput]);

  if (!authReady || loading || !data) {
    return (
      <div className="min-h-screen bg-[var(--sp-bg)] text-[var(--sp-ink)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <SphereLogo size={42} tone="brand" />
          <p className="text-xs font-mono-code text-[var(--sp-muted)]">
            Loading Sphere. workspace...
          </p>
        </div>
      </div>
    );
  }

  // Email verification pending gate when user returned from email inbox before verifying
  if (!currentUser && unverifiedEmail && !signUpOpen && !signInOpen) {
    return (
      <div className="min-h-screen bg-[var(--sp-bg)] text-[var(--sp-ink)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <Mail className="w-10 h-10 text-[#06B6D4] mx-auto" />
          <h1 className="font-display text-xl font-extrabold">Verify Your Email to Continue</h1>
          <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed">
            A verification link was sent to <strong>{unverifiedEmail}</strong>. Open your inbox, click the verification link, and then tap Check Verification below.
          </p>
          {authGateMsg && (
            <div className="p-2.5 rounded-lg bg-[var(--sp-primary-soft)] text-xs text-[var(--sp-primary-text)]">
              {authGateMsg}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={async () => {
                const updated = await refreshCurrentFirebaseUser();
                if (updated && isFirebaseUserVerified(updated)) {
                  setUnverifiedEmail(null);
                  const res = await apiSyncFirebaseSession({
                    uid: updated.uid,
                    email: updated.email,
                    phoneNumber: updated.phoneNumber,
                    displayName: updated.displayName,
                    emailVerified: updated.emailVerified,
                  });
                  if (res.user) {
                    handleAuthenticated(res.user);
                  } else if (res.needsOnboarding) {
                    setSignInOpen(true);
                  }
                } else {
                  setAuthGateMsg('Email is not verified yet. Please click the verification link in your inbox first.');
                }
              }}
              className="w-full py-2.5 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check Verification Status</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmailForCurrentUser();
                setAuthGateMsg(`Verification email resent to ${unverifiedEmail}.`);
              }}
              className="w-full py-2 rounded-lg border border-[var(--sp-border)] text-xs font-semibold cursor-pointer"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="text-xs text-red-500 hover:underline font-semibold cursor-pointer pt-1"
            >
              Sign Out &amp; Use Another Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Logged-out / Incognito experience: Public Landing + Account Recovery Center + SignIn / SignUp + Policy Guidelines
  if (!currentUser) {
    if (loggedOutRecoveryOpen) {
      return (
        <div className="min-h-screen bg-[var(--sp-bg)] text-[var(--sp-ink)]">
          <Suspense
            fallback={
              <div className="p-12 text-center text-xs text-[var(--sp-muted)]">
                Loading Account Recovery Center...
              </div>
            }
          >
            <AccountRecoveryCenterView
              initialEmailToken={initialRecoveryToken}
              onBack={() => setLoggedOutRecoveryOpen(false)}
              onRecoveryCompleted={() => {
                setLoggedOutRecoveryOpen(false);
                setSignInOpen(true);
              }}
            />
          </Suspense>
        </div>
      );
    }

    return (
      <>
        <PublicLanding
          totalGlobalPopulation={data.totalGlobalPopulation || TOTAL_GLOBAL_DIRECTORY_COUNT}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          onOpenSignIn={() => setSignInOpen(true)}
          onOpenSignUp={() => setSignUpOpen(true)}
          onOpenGuidelines={() => setGuidelinesOpen(true)}
          onOpenRecovery={() => setLoggedOutRecoveryOpen(true)}
        />
        <SignInModal
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
          onAuthenticated={handleAuthenticated}
          onSwitchToSignUp={() => {
            setSignInOpen(false);
            setSignUpOpen(true);
          }}
          onOpenRecovery={() => setLoggedOutRecoveryOpen(true)}
        />
        <SignUpModal
          open={signUpOpen}
          onClose={() => setSignUpOpen(false)}
          onAuthenticated={handleAuthenticated}
          onOpenGuidelines={() => setGuidelinesOpen(true)}
        />
        <PolicyGuidelinesModal
          open={guidelinesOpen}
          onClose={() => setGuidelinesOpen(false)}
        />
        <PhotoLightboxModal
          photo={null}
          customMedia={activeMedia}
          currentUser={null}
          users={data.users}
          pages={data.pages}
          onSelectCustomMedia={(media) => openImage(media)}
          onClose={closeImage}
          onRefresh={async () => {}}
          onNavigate={setRoute}
        />
      </>
    );
  }

  const lightboxPhoto = lightboxPhotoId
    ? data.photos.find((p) => p.id === lightboxPhotoId) || null
    : null;

  return (
    <div className="min-h-screen bg-[var(--sp-bg)] text-[var(--sp-ink)] flex flex-col">
      {/* 3-ZONE STICKY TOP HEADER */}
      <header className="sticky top-0 z-40 h-16 bg-[var(--sp-surface)]/95 backdrop-blur-md border-b border-[var(--sp-border)] px-3 sm:px-6 flex items-center justify-between gap-3">
        {/* Left Zone: Sphere Brand + Live Search */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setRoute({ page: 'home', viewMode: 'pulse' })}
            className="flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <SphereLogo size={32} />
            <span className="font-display text-xl font-extrabold tracking-tight text-[var(--sp-ink)]">
              Sphere.
            </span>
          </button>

          <div className="relative hidden sm:block w-56 md:w-68">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!searchInput.trim()) return;
                setSearchFocused(false);
                setRoute({ page: 'search', query: searchInput.trim(), filter: 'all' });
              }}
            >
              <Search className="w-4 h-4 text-[var(--sp-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search Sphere. people, Pages, posts..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-full bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--sp-primary)]/30"
              />
            </form>

            {searchFocused &&
              searchInput.trim().length > 0 &&
              (liveSearchDropdown.people.length > 0 || liveSearchDropdown.pages.length > 0) && (
                <div className="absolute left-0 right-0 top-10 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-xl shadow-xl p-2 space-y-1 z-50">
                  {liveSearchDropdown.people.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() =>
                        setRoute({ page: 'profile', userId: u.id, tab: 'timeline' })
                      }
                      className="w-full p-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center gap-2 text-left text-xs cursor-pointer"
                    >
                      <UserAvatar user={u} size="xs" />
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--sp-ink)] truncate">{u.name}</div>
                        <div className="text-[10px] text-[var(--sp-muted)] truncate">
                          {u.location}
                        </div>
                      </div>
                    </button>
                  ))}
                  {liveSearchDropdown.pages.map((pg) => (
                    <button
                      key={pg.id}
                      type="button"
                      onMouseDown={() =>
                        setRoute({ page: 'discover', tab: 'pages', pageId: pg.id })
                      }
                      className="w-full p-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center justify-between text-left text-xs cursor-pointer"
                    >
                      <span className="font-bold text-[var(--sp-primary-text)] truncate">
                        {pg.name}
                      </span>
                      <span className="text-[10px] text-[var(--sp-muted)]">Page</span>
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Center Zone: 5 Core Nav Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {(
            [
              { id: 'home', label: 'Pulse', icon: Home, route: { page: 'home', viewMode: 'pulse' } as NavRoute },
              { id: 'global', label: 'Global Circle', icon: Compass, route: { page: 'global', tab: 'circle' } as NavRoute },
              { id: 'discover', label: 'Pages & Circles', icon: Users, route: { page: 'discover', tab: 'pages' } as NavRoute },
              { id: 'marketplace', label: 'Shelves', icon: ShoppingBag, route: { page: 'marketplace' } as NavRoute },
              { id: 'donations', label: 'Aid Drives', icon: HeartHandshake, route: { page: 'donations' } as NavRoute },
            ] as const
          ).map((item) => {
            const active = route.page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoute(item.route)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)]'
                    : 'text-[var(--sp-ink-2)] hover:bg-[var(--sp-surface-alt)]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Zone: Actions + Account */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setGuidelinesOpen(true)}
            title="Sphere Policy Guidelines"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-xs font-semibold text-[var(--sp-ink)] whitespace-nowrap cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
            <span>Policy Guidelines</span>
          </button>

          <button
            type="button"
            onClick={() => setRoute({ page: 'messages' })}
            aria-label="Open Messenger"
            className="relative p-2 rounded-full bg-[var(--sp-surface-alt)] hover:bg-[var(--sp-primary-soft)] text-[var(--sp-ink)] cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            {totalUnreadChats > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {totalUnreadChats}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={async () => {
                const next = !notifOpen;
                setNotifOpen(next);
                setAccountMenuOpen(false);
                if (next && unreadNotifs.length > 0) {
                  await apiMarkNotificationsRead(currentUser.id);
                  await loadBootstrap(currentUser.id);
                }
              }}
              aria-label="Notifications"
              className="relative p-2 rounded-full bg-[var(--sp-surface-alt)] hover:bg-[var(--sp-primary-soft)] text-[var(--sp-ink)] cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#06B6D4] text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifs.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl p-3 space-y-2 z-50">
                <div className="text-xs font-bold text-[var(--sp-ink)] flex items-center justify-between pb-1 border-b border-[var(--sp-border-subtle)]">
                  <span>Notifications</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      setRoute({ page: 'privacy' });
                    }}
                    className="text-[11px] text-[var(--sp-primary-text)] hover:underline cursor-pointer"
                  >
                    Approvals Center
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {data.notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--sp-muted)]">
                      All caught up!
                    </div>
                  ) : (
                    data.notifications.slice(0, 10).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.type === 'tag_request' || n.type === 'wall_request') {
                            setRoute({ page: 'privacy' });
                          } else if (n.type === 'donation') {
                            setRoute({ page: 'donations' });
                          } else {
                            setRoute({ page: 'home' });
                          }
                        }}
                        className="w-full p-2 rounded-xl hover:bg-[var(--sp-surface-alt)] text-left text-xs space-y-0.5 cursor-pointer"
                      >
                        <div className="text-[var(--sp-ink)] font-medium">{n.text}</div>
                        <div className="text-[10px] text-[var(--sp-muted)]">{n.createdAt}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle theme"
            className="p-2 rounded-full bg-[var(--sp-surface-alt)] hover:bg-[var(--sp-primary-soft)] text-[var(--sp-ink)] cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Account Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] cursor-pointer"
            >
              <UserAvatar user={currentUser} size="xs" isOnline />
              <span className="hidden sm:inline text-xs font-bold text-[var(--sp-ink)] whitespace-nowrap">
                {currentUser.name.split(' ')[0]}
              </span>
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 top-12 w-72 bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl p-3 space-y-2 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setRoute({ page: 'profile', userId: currentUser.id, tab: 'timeline' });
                  }}
                  className="w-full p-2.5 rounded-xl bg-[var(--sp-surface-alt)] flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <UserAvatar user={currentUser} size="md" isOnline />
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--sp-ink)] truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] text-[var(--sp-muted)] truncate">
                      View MySpace Profile
                    </div>
                  </div>
                </button>

                <div className="space-y-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setGuidelinesOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sphere Policy Guidelines</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setRoute({ page: 'security' });
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Account Security Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setRoute({ page: 'recovery' });
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Account Recovery Center</span>
                  </button>
                  {(currentUser.securityRoles || []).some((r) => r !== 'regular_user') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setRoute({ page: 'verification-dashboard' });
                      }}
                      className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-primary-soft)] text-[var(--sp-primary-text)] font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Identity &amp; Security Desk</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setRoute({ page: 'privacy' });
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Privacy &amp; Tagging Controls</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setRoute({ page: 'anonymous' });
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center gap-2 cursor-pointer"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Anonymous Safe Topics</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setRoute({ page: 'ads' });
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center gap-2 cursor-pointer"
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>Ads Manager &amp; Boosted Posts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setSphereIdOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[var(--sp-surface-alt)] flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                    <span>Sphere ID Verification</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="w-full px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold flex items-center gap-2 cursor-pointer border-t border-[var(--sp-border-subtle)] mt-1 pt-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAV BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--sp-surface)] border-t border-[var(--sp-border)] px-2 py-1.5 flex items-center justify-around">
        {[
          { label: 'Pulse', icon: Home, route: { page: 'home', viewMode: 'pulse' } as NavRoute },
          { label: 'Global', icon: Globe, route: { page: 'global', tab: 'circle' } as NavRoute },
          { label: 'Pages', icon: Users, route: { page: 'discover', tab: 'pages' } as NavRoute },
          { label: 'Shelves', icon: ShoppingBag, route: { page: 'marketplace' } as NavRoute },
          { label: 'Aid', icon: HeartHandshake, route: { page: 'donations' } as NavRoute },
        ].map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => setRoute(m.route)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer ${
              route.page === m.route.page
                ? 'text-[var(--sp-primary-text)]'
                : 'text-[var(--sp-muted)]'
            }`}
          >
            <m.icon className="w-4 h-4" />
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* MAIN ROUTE CONTENT */}
      <div className="flex-1 pb-16 md:pb-6">
        <Suspense
          fallback={
            <div className="max-w-5xl mx-auto px-4 py-12 text-center text-xs text-[var(--sp-muted)]">
              Loading Sphere. view...
            </div>
          }
        >
        {route.page === 'home' && (
          <FeedView
            currentUser={currentUser}
            users={data.users}
            posts={data.posts}
            photos={data.photos}
            albums={data.albums}
            pages={data.pages}
            groups={data.groups}
            marketplace={data.marketplace}
            adCampaigns={data.adCampaigns}
            onlineUserIds={onlineUserIds}
            activeHashtag={route.hashtag}
            activeLocation={route.location}
            initialViewMode={route.viewMode || 'pulse'}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            onRefresh={() => loadBootstrap(currentUser.id)}
            onNavigate={setRoute}
            onOpenPhoto={(id) => {
              closeImage();
              setLightboxPhotoId(id);
            }}
            onSharePost={(p) => setSharePost(p)}
            onOpenLive={(p) => setLiveModalState({ open: true, post: p || null })}
            onMessageUser={(uid) => void openChatWithUser(uid)}
            onBoostPost={(postId) => {
              setBoostPostId(postId);
              setRoute({ page: 'ads' });
            }}
            onOpenSphereId={() => setSphereIdOpen(true)}
            onOpenGuidelines={() => setGuidelinesOpen(true)}
          />
        )}

        {route.page === 'profile' && (() => {
          const target =
            data.users.find((u) => u.id === route.userId) ||
            (route.userId.startsWith('virt-') ? getVirtualUserById(route.userId) : null) ||
            currentUser;
          return (
            <ProfileView
              key={target.id}
              profileUser={target}
              currentUser={currentUser}
              users={data.users}
              posts={data.posts}
              photos={data.photos}
              albums={data.albums}
              pages={data.pages}
              groups={data.groups}
              marketplace={data.marketplace}
              testimonials={data.testimonials}
              onlineUserIds={onlineUserIds}
              initialTab={route.tab || 'timeline'}
              onRefresh={() => loadBootstrap(currentUser.id)}
              onNavigate={setRoute}
              onOpenPhoto={(id) => {
                closeImage();
                setLightboxPhotoId(id);
              }}
              onSharePost={(p) => setSharePost(p)}
              onOpenLive={(p) => setLiveModalState({ open: true, post: p })}
              onMessageUser={(uid) => void openChatWithUser(uid)}
              onBoostPost={(postId) => {
                setBoostPostId(postId);
                setRoute({ page: 'ads' });
              }}
              onOpenSphereId={() => setSphereIdOpen(true)}
              onOpenEditProfile={() => setEditProfileOpen(true)}
              onOpenPhotoManager={(mode) => setPhotoManagerMode(mode)}
            />
          );
        })()}

        {route.page === 'global' && (
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
            <GlobalCircleView
              activeTab={route.tab || 'circle'}
              initialCategory={route.category || 'All'}
              totalGlobalPopulation={data.totalGlobalPopulation || TOTAL_GLOBAL_DIRECTORY_COUNT}
              users={data.users}
              currentUser={currentUser}
              onlineUserIds={onlineUserIds}
              onNavigate={setRoute}
              onToggleFriend={async (uid) => {
                await apiToggleFriend(uid, currentUser.id, 'toggle');
                await loadBootstrap(currentUser.id);
              }}
              onMessageUser={(uid) => void openChatWithUser(uid)}
              onEditProfile={() => setEditProfileOpen(true)}
              onOpenSphereId={() => setSphereIdOpen(true)}
            />
          </div>
        )}

        {route.page === 'anonymous' && (
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
            <AnonymousView
              currentUser={currentUser}
              posts={data.anonymousPosts}
              initialTopic={route.topic || 'All'}
              onRefresh={() => loadBootstrap(currentUser.id)}
            />
          </div>
        )}

        {route.page === 'donations' && (
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
            <DonationDrivesView
              currentUser={currentUser}
              drives={data.donationDrives}
              onRefresh={() => loadBootstrap(currentUser.id)}
              onOpenSphereId={() => setSphereIdOpen(true)}
            />
          </div>
        )}

        {route.page === 'ads' && (
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
            <AdsDashboardView
              currentUser={currentUser}
              users={data.users}
              posts={data.posts}
              adCampaigns={data.adCampaigns}
              initialBoostPostId={boostPostId}
              onRefresh={() => loadBootstrap(currentUser.id)}
            />
          </div>
        )}

        {route.page === 'privacy' && (
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
            <PrivacyControlsView
              currentUser={currentUser}
              users={data.users}
              posts={data.posts}
              onRefresh={() => loadBootstrap(currentUser.id)}
            />
          </div>
        )}

        {route.page === 'messages' && (
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
            <MessagesView
              currentUser={currentUser}
              users={data.users}
              threads={data.threads}
              onlineUserIds={onlineUserIds}
              typingByThread={typingByThread}
              initialThreadId={route.threadId}
              onSendMessage={async (threadId, text, attachments) => {
                await apiSendMessage(threadId, {
                  senderId: currentUser.id,
                  text,
                  attachments,
                });
                await loadBootstrap(currentUser.id);
              }}
              onMarkRead={(threadId) => {
                void apiMarkThreadRead(threadId, currentUser.id).then(() =>
                  loadBootstrap(currentUser.id)
                );
              }}
              onPopOutThread={handleOpenThread}
              onToggleAutoTranslate={async () => {
                await apiUpdateUser(currentUser.id, {
                  autoTranslate: !currentUser.autoTranslate,
                });
                await loadBootstrap(currentUser.id);
              }}
              onNavigate={setRoute}
              onStartCall={handleStartCall}
              onOpenCreateGroup={() => setCreateGroupOpen(true)}
              onOpenGroupSettings={(threadId) => setGroupSettingsThreadId(threadId)}
            />
          </div>
        )}

        {(route.page === 'discover' || route.page === 'marketplace' || route.page === 'friends') && (
          <DiscoverHubView
            mode={
              route.page === 'marketplace'
                ? 'marketplace'
                : route.page === 'friends'
                  ? 'friends'
                  : route.tab || 'pages'
            }
            selectedPageId={route.page === 'discover' ? route.pageId : undefined}
            selectedGroupId={route.page === 'discover' ? route.groupId : undefined}
            selectedListingId={route.page === 'marketplace' ? route.listingId : undefined}
            currentUser={currentUser}
            users={data.users}
            posts={data.posts}
            photos={data.photos}
            albums={data.albums}
            pages={data.pages}
            groups={data.groups}
            marketplace={data.marketplace}
            testimonials={data.testimonials}
            onlineUserIds={onlineUserIds}
            onRefresh={() => loadBootstrap(currentUser.id)}
            onNavigate={setRoute}
            onOpenPhoto={(id) => {
              closeImage();
              setLightboxPhotoId(id);
            }}
            onSharePost={(p) => setSharePost(p)}
            onOpenLive={(p) => setLiveModalState({ open: true, post: p })}
            onMessageUser={(uid) => void openChatWithUser(uid)}
            onBoostPost={(postId) => {
              setBoostPostId(postId);
              setRoute({ page: 'ads' });
            }}
            onOpenSphereId={() => setSphereIdOpen(true)}
          />
        )}

        {route.page === 'search' && (
          <SearchResultsView
            query={route.query}
            initialFilter={route.filter}
            users={data.users}
            pages={data.pages}
            posts={data.posts}
            groups={data.groups}
            photos={data.photos}
            onNavigate={setRoute}
            onOpenPhoto={(id) => {
              closeImage();
              setLightboxPhotoId(id);
            }}
          />
        )}

        {route.page === 'recovery' && (
          <AccountRecoveryCenterView
            currentUser={currentUser}
            initialTab={route.initialTab}
            initialEmailToken={initialRecoveryToken || route.token || ''}
            initialReferenceNumber={route.referenceNumber}
            onBack={() => setRoute({ page: 'home', viewMode: 'pulse' })}
            onRecoveryCompleted={() => void loadBootstrap(currentUser.id)}
          />
        )}

        {route.page === 'security' && (
          <AccountSecuritySettingsView
            currentUser={currentUser}
            onRefreshBootstrap={() => loadBootstrap(currentUser.id)}
            onOpenRecoveryTracker={(refNumber) =>
              setRoute({ page: 'recovery', initialTab: 'status', referenceNumber: refNumber })
            }
            onOpenRestrictedDashboard={() => setRoute({ page: 'verification-dashboard' })}
          />
        )}

        {route.page === 'verification-dashboard' && (
          <VerificationSecurityDashboardsView
            currentUser={currentUser}
            onRefreshBootstrap={() => loadBootstrap(currentUser.id)}
          />
        )}
        </Suspense>
      </div>

      {/* QUIET FOOTER WITH SPHERE POLICY GUIDELINES */}
      <footer className="border-t border-[var(--sp-border-subtle)] bg-[var(--sp-surface)]/70 py-4 px-4 sm:px-6 text-[11px] text-[var(--sp-muted)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>Sphere. · Built for honest, authentic community connection.</span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setGuidelinesOpen(true)}
              className="font-semibold text-[var(--sp-primary-text)] hover:underline cursor-pointer"
            >
              Sphere Policy Guidelines
            </button>
            <button
              type="button"
              onClick={() => setRoute({ page: 'security' })}
              className="hover:underline cursor-pointer"
            >
              Account Security
            </button>
            <button
              type="button"
              onClick={() => setRoute({ page: 'recovery' })}
              className="hover:underline cursor-pointer"
            >
              Recovery Center
            </button>
            <button
              type="button"
              onClick={() => setRoute({ page: 'privacy' })}
              className="hover:underline cursor-pointer"
            >
              Privacy &amp; Tagging
            </button>
            <button
              type="button"
              onClick={() => setSphereIdOpen(true)}
              className="hover:underline cursor-pointer"
            >
              Sphere ID
            </button>
          </div>
        </div>
      </footer>

      {/* PERSISTENT FLOATING MESSENGER CHAT DOCK */}
      <FloatingMessenger
        currentUser={currentUser}
        users={data.users}
        threads={data.threads}
        onlineUserIds={onlineUserIds}
        typingByThread={typingByThread}
        openThreadIds={openThreadIds}
        minimizedThreadIds={minimizedThreadIds}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        onOpenThread={handleOpenThread}
        onMinimizeThread={handleMinimizeThread}
        onCloseThread={handleCloseThread}
        onSendMessage={async (threadId, text, attachments?: AttachmentItem[]) => {
          await apiSendMessage(threadId, {
            senderId: currentUser.id,
            text,
            attachments,
          });
          await loadBootstrap(currentUser.id);
        }}
        onMarkRead={(threadId) => {
          void apiMarkThreadRead(threadId, currentUser.id).then(() =>
            loadBootstrap(currentUser.id)
          );
        }}
        onReactMessage={(threadId, messageId, emoji) => {
          void apiReactMessage(threadId, messageId, currentUser.id, emoji).then(() =>
            loadBootstrap(currentUser.id)
          );
        }}
        onTypingChange={handleTypingChange}
        onNavigate={setRoute}
        onStartCall={handleStartCall}
        onOpenCreateGroup={() => setCreateGroupOpen(true)}
        onOpenGroupSettings={(threadId) => setGroupSettingsThreadId(threadId)}
        onReplaceGroupLogo={handleReplaceGroupLogo}
      />

      {/* MODALS */}
      <PolicyGuidelinesModal
        open={guidelinesOpen}
        onClose={() => setGuidelinesOpen(false)}
      />

      <PhotoLightboxModal
        photo={lightboxPhoto}
        photos={data.photos}
        customMedia={activeMedia}
        currentUser={currentUser}
        users={data.users}
        pages={data.pages}
        onSelectPhoto={(id) => {
          closeImage();
          setLightboxPhotoId(id);
        }}
        onSelectCustomMedia={(media) => openImage(media)}
        onClose={() => {
          setLightboxPhotoId(null);
          closeImage();
        }}
        onRefresh={() => loadBootstrap(currentUser.id)}
        onNavigate={setRoute}
      />

      <SharePostModal
        post={sharePost}
        currentUser={currentUser}
        users={data.users}
        onClose={() => setSharePost(null)}
        onRefresh={() => loadBootstrap(currentUser.id)}
        onSendInMessenger={(uid, post) => void handleSendInMessenger(uid, post)}
      />

      <EditProfileModal
        open={editProfileOpen}
        currentUser={currentUser}
        onClose={() => setEditProfileOpen(false)}
        onRefresh={() => loadBootstrap(currentUser.id)}
      />

      <SphereIdModal
        open={sphereIdOpen}
        currentUser={currentUser}
        requests={data.verificationRequests}
        onClose={() => setSphereIdOpen(false)}
        onRefresh={() => loadBootstrap(currentUser.id)}
      />

      {photoManagerMode && (
        <PhotoManagerModal
          open={Boolean(photoManagerMode)}
          mode={photoManagerMode}
          currentUser={currentUser}
          existingPhotos={data.photos}
          onClose={() => setPhotoManagerMode(null)}
          onSavePhotoUrl={async (url) => {
            await apiUpdateUser(
              currentUser.id,
              photoManagerMode === 'avatar' ? { avatar: url || '' } : { coverImage: url || '' }
            );
            await loadBootstrap(currentUser.id);
          }}
        />
      )}

      {liveModalState.open && (
        <Suspense fallback={null}>
          <LiveStreamModal
            open={liveModalState.open}
            currentUser={currentUser}
            users={data.users}
            viewingPost={liveModalState.post}
            onClose={() => setLiveModalState({ open: false, post: null })}
            onStreamStarted={() => void loadBootstrap(currentUser.id)}
            onStreamUpdated={(updatedPost) => {
              setLiveModalState((prev) => ({ ...prev, post: updatedPost }));
              void loadBootstrap(currentUser.id);
            }}
          />
        </Suspense>
      )}

      <CreateGroupChatModal
        open={createGroupOpen}
        currentUser={currentUser}
        users={data.users}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={async (thread) => {
          await loadBootstrap(currentUser.id);
          handleOpenThread(thread.id);
        }}
      />

      <GroupSettingsModal
        thread={
          groupSettingsThreadId
            ? data.threads.find((t) => t.id === groupSettingsThreadId) || null
            : null
        }
        currentUser={currentUser}
        onClose={() => setGroupSettingsThreadId(null)}
        onUpdated={() => loadBootstrap(currentUser.id)}
      />

      {activeCallSession && (
        <Suspense fallback={null}>
          <CallStageModal
            session={activeCallSession}
            thread={
              data.threads.find((t) => t.id === activeCallSession.threadId) || null
            }
            currentUser={currentUser}
            users={data.users}
            wsRef={wsRef}
            onSendSnapshotToChat={handleSendSnapshotToChat}
            onEndCall={() => setActiveCallSession(null)}
          />
        </Suspense>
      )}

      {incomingCall && !activeCallSession && (() => {
        const caller =
          data.users.find((u) => u.id === incomingCall.fromUserId) ||
          (incomingCall.fromUserId.startsWith('virt-')
            ? getVirtualUserById(incomingCall.fromUserId)
            : null);
        return (
          <IncomingCallToast
            callerName={caller?.name || 'Sphere. Member'}
            mode={incomingCall.mode}
            onAccept={() => {
              const accepted = incomingCall;
              setIncomingCall(null);
              handleOpenThread(accepted.threadId);
              setActiveCallSession({
                threadId: accepted.threadId,
                mode: accepted.mode,
                incomingFromUserId: accepted.fromUserId,
                remoteOffer: accepted.offer,
              });
            }}
            onDecline={() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'call:decline',
                    threadId: incomingCall.threadId,
                    fromUserId: currentUser.id,
                  })
                );
              }
              setIncomingCall(null);
            }}
          />
        );
      })()}
    </div>
  );
}
