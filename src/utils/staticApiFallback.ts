import {
  AdCampaign,
  AdObjective,
  AdStatus,
  AlbumItem,
  AnonymousPost,
  AnonymousTopic,
  AttachmentItem,
  DiscoveryCategory,
  DonationDrive,
  GroupItem,
  LiveStreamComment,
  MarketplaceItem,
  MessageThread,
  NotificationItem,
  PageItem,
  PhotoItem,
  PrivacyLevel,
  ReactionType,
  SocialPost,
  SphereIdVerificationRequest,
  TestimonialItem,
  UserProfile,
  VideoFormat,
} from '../types/social';
import {
  canPostOnWall,
  canSatisfyPrivacy,
  canTagUser,
  canViewAlbum,
  canViewPhoto,
  canViewPost,
  checkSafeContent,
  generateAnonymousAlias,
} from './discovery';
import {
  TOTAL_GLOBAL_DIRECTORY_COUNT,
  getVirtualUserById,
  queryGlobalDirectory,
  sampleGlobalMemberIds,
} from './globalDirectory';
import { applyReactionRules } from './reactions';
import { getCategoryGuidelines } from './communityRules';
import type { SphereDatabase } from '../../server/seedData';

const STORAGE_KEY = 'sphere_static_state_v1';
const ADMIN_EMAILS = new Set(['adrrycanal@gmail.com', 'adrian.villanueva@sphere.ph']);

let memDb: SphereDatabase | null = null;
let seedModulePromise: Promise<{
  seedData: typeof import('../../server/seedData');
  lifeGen: typeof import('../../server/friendLifeGenerator');
}> | null = null;

async function loadSeedModules() {
  if (!seedModulePromise) {
    seedModulePromise = Promise.all([
      import('../../server/seedData'),
      import('../../server/friendLifeGenerator'),
    ]).then(([seedData, lifeGen]) => ({ seedData, lifeGen }));
  }
  return seedModulePromise;
}

function saveStaticDb(db: SphereDatabase) {
  memDb = db;
  try {
    // Store compact delta-friendly snapshot (omit unmodified imf-* and page-adrian-* bulk entries to stay well under 5MB localStorage limit)
    const nonBulkUsers = db.users.filter((u) => !u.id.startsWith('imf-'));
    const nonBulkPages = db.pages.filter((p) => !p.id.startsWith('page-adrian-'));
    const snapshot = {
      users: nonBulkUsers,
      pages: nonBulkPages,
      groups: db.groups,
      posts: db.posts,
      photos: db.photos,
      albums: db.albums,
      marketplace: db.marketplace,
      testimonials: db.testimonials,
      threads: db.threads,
      anonymousPosts: db.anonymousPosts,
      verificationRequests: db.verificationRequests,
      adCampaigns: db.adCampaigns,
      donationDrives: db.donationDrives,
      notifications: db.notifications.slice(0, 60),
      friendships: {
        adrian: (db.friendships.adrian || []).filter((id) => !id.startsWith('imf-')),
        ...Object.fromEntries(
          Object.entries(db.friendships).filter(([k]) => k !== 'adrian' && !k.startsWith('imf-'))
        ),
      },
      outgoingRequests: db.outgoingRequests,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

async function getStaticDb(): Promise<{
  db: SphereDatabase;
  seedData: typeof import('../../server/seedData');
  lifeGen: typeof import('../../server/friendLifeGenerator');
}> {
  const { seedData, lifeGen } = await loadSeedModules();
  if (memDb) {
    return { db: memDb, seedData, lifeGen };
  }

  const base = seedData.createInitialSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<SphereDatabase>;
      if (Array.isArray(saved.users)) {
        const userMap = new Map(base.users.map((u) => [u.id, u]));
        for (const su of saved.users) {
          userMap.set(su.id, su);
        }
        base.users = Array.from(userMap.values());
      }
      if (Array.isArray(saved.pages)) {
        const pageMap = new Map(base.pages.map((p) => [p.id, p]));
        for (const sp of saved.pages) {
          pageMap.set(sp.id, sp);
        }
        base.pages = Array.from(pageMap.values());
      }
      if (Array.isArray(saved.groups)) base.groups = saved.groups;
      if (Array.isArray(saved.posts)) base.posts = saved.posts;
      if (Array.isArray(saved.photos)) base.photos = saved.photos;
      if (Array.isArray(saved.albums)) base.albums = saved.albums;
      if (Array.isArray(saved.marketplace)) base.marketplace = saved.marketplace;
      if (Array.isArray(saved.testimonials)) base.testimonials = saved.testimonials;
      if (Array.isArray(saved.threads)) base.threads = saved.threads;
      if (Array.isArray(saved.anonymousPosts)) base.anonymousPosts = saved.anonymousPosts;
      if (Array.isArray(saved.verificationRequests)) base.verificationRequests = saved.verificationRequests;
      if (Array.isArray(saved.adCampaigns)) base.adCampaigns = saved.adCampaigns;
      if (Array.isArray(saved.donationDrives)) base.donationDrives = saved.donationDrives;
      if (Array.isArray(saved.notifications)) base.notifications = saved.notifications;
      if (saved.outgoingRequests) base.outgoingRequests = saved.outgoingRequests;
      if (saved.friendships) {
        for (const [uid, list] of Object.entries(saved.friendships)) {
          if (uid === 'adrian') {
            base.friendships.adrian = Array.from(new Set([...(base.friendships.adrian || []), ...list]));
          } else {
            base.friendships[uid] = list;
          }
        }
      }
      seedData.migrateSeedData(base);
    }
  } catch {
    // Use clean seed on corrupted localStorage
  }

  memDb = base;
  return { db: memDb, seedData, lifeGen };
}

function buildFriendshipMap(db: SphereDatabase): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const [uid, list] of Object.entries(db.friendships)) {
    map[uid] = new Set(list);
  }
  return map;
}

function ensureUserInDb(db: SphereDatabase, userId: string): UserProfile | undefined {
  const existing = db.users.find((u) => u.id === userId);
  if (existing) return existing;
  if (userId.startsWith('virt-')) {
    const virtualUser = getVirtualUserById(userId);
    if (virtualUser) {
      db.users.push(virtualUser);
      db.friendships[userId] = db.friendships[userId] || [];
      db.outgoingRequests[userId] = db.outgoingRequests[userId] || [];
      return virtualUser;
    }
  }
  return undefined;
}

function addNotification(
  db: SphereDatabase,
  notif: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>
) {
  const entry: NotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    read: false,
    createdAt: 'Just now',
    ...notif,
  };
  db.notifications.unshift(entry);
  if (db.notifications.length > 80) {
    db.notifications = db.notifications.slice(0, 80);
  }
}

function calculateAge(birthday: string): number {
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

const CURATED_GIFS = [
  { id: 'gif-party', slug: 'party', title: 'Party Time Confetti', category: 'Celebration', tags: ['party', 'celebrate', 'congrats', 'happy', 'fiesta'], bg1: '#4F46E5', bg2: '#EC4899', accent: '#FACC15', emoji: '🎉', caption: 'LET’S GO!', motion: 'bounce' },
  { id: 'gif-fire', slug: 'fire', title: 'On Fire Lit', category: 'Reactions', tags: ['fire', 'lit', 'hot', 'awesome', 'solid'], bg1: '#EA580C', bg2: '#DC2626', accent: '#FDE047', emoji: '🔥', caption: 'SO SOLID!', motion: 'pulse' },
  { id: 'gif-heart', slug: 'heart', title: 'Sending Big Love', category: 'Reactions', tags: ['love', 'heart', 'hug', 'sweet', 'mahal'], bg1: '#DB2777', bg2: '#9333EA', accent: '#FDA4AF', emoji: '💖', caption: 'BIG LOVE', motion: 'pulse' },
  { id: 'gif-laugh', slug: 'laugh', title: 'Crying Laughing', category: 'Reactions', tags: ['laugh', 'lol', 'haha', 'funny', 'tawa'], bg1: '#D97706', bg2: '#F59E0B', accent: '#FEF08A', emoji: '😂', caption: 'HAHAHA!', motion: 'bounce' },
  { id: 'gif-clap', slug: 'clap', title: 'Round of Applause', category: 'Celebration', tags: ['clap', 'applause', 'bravo', 'galing', 'cheers'], bg1: '#0D9488', bg2: '#0284C7', accent: '#99F6E4', emoji: '👏', caption: 'GALING!', motion: 'wave' },
  { id: 'gif-cool', slug: 'cool', title: 'Cool Shades Vibe', category: 'Reactions', tags: ['cool', 'chill', 'sunglasses', 'deal', 'pogi'], bg1: '#1E293B', bg2: '#4F46E5', accent: '#22D3EE', emoji: '😎', caption: 'CHILL VIBES', motion: 'wave' },
  { id: 'gif-rocket', slug: 'rocket', title: 'Launch To The Moon', category: 'Tech & Gaming', tags: ['rocket', 'launch', 'ship', 'moon', 'deploy'], bg1: '#0F172A', bg2: '#0369A1', accent: '#38BDF8', emoji: '🚀', caption: 'SHIP IT!', motion: 'bounce' },
  { id: 'gif-gg', slug: 'gg', title: 'GGWP Victory', category: 'Tech & Gaming', tags: ['gg', 'gaming', 'win', 'trophy', 'clutch'], bg1: '#4338CA', bg2: '#06B6D4', accent: '#FDE047', emoji: '🏆', caption: 'GGWP!', motion: 'pulse' },
  { id: 'gif-coffee', slug: 'coffee', title: 'Tara Kape Break', category: 'Pinoy Vibes', tags: ['coffee', 'kape', 'morning', 'tara', 'cafe'], bg1: '#78350F', bg2: '#B45309', accent: '#FDE68A', emoji: '☕', caption: 'TARA KAPE!', motion: 'wave' },
  { id: 'gif-wave', slug: 'wave', title: 'Hello Friend Wave', category: 'Pinoy Vibes', tags: ['hello', 'hi', 'wave', 'kumusta', 'hey'], bg1: '#0891B2', bg2: '#4F46E5', accent: '#A5F3FC', emoji: '👋', caption: 'KUMUSTA!', motion: 'wave' },
  { id: 'gif-mindblown', slug: 'mindblown', title: 'Mind Blown Shock', category: 'Reactions', tags: ['mind', 'blown', 'wow', 'shock', 'grabe'], bg1: '#7C3AED', bg2: '#F43F5E', accent: '#FDE047', emoji: '🤯', caption: 'MIND BLOWN!', motion: 'pulse' },
  { id: 'gif-thumbsup', slug: 'thumbsup', title: '100% Approved', category: 'Reactions', tags: ['ok', 'yes', 'thumbs', 'approve', 'good'], bg1: '#059669', bg2: '#10B981', accent: '#D1FAE5', emoji: '👍', caption: 'APPROVED!', motion: 'bounce' },
  { id: 'gif-music', slug: 'music', title: 'Vibe Check Beats', category: 'Trending', tags: ['music', 'dance', 'beats', 'jam', 'tugtog'], bg1: '#6D28D9', bg2: '#06B6D4', accent: '#F472B6', emoji: '🎧', caption: 'VIBE CHECK', motion: 'pulse' },
  { id: 'gif-moto', slug: 'moto', title: 'Full Throttle Ride', category: 'Pinoy Vibes', tags: ['moto', 'ride', 'motorcycle', 'ridesafe', 'bike'], bg1: '#1E293B', bg2: '#B91C1C', accent: '#22D3EE', emoji: '🏍️', caption: 'RIDE SAFE!', motion: 'bounce' },
  { id: 'gif-code', slug: 'code', title: 'Coding In Flow', category: 'Tech & Gaming', tags: ['code', 'dev', 'computer', 'pc', 'build'], bg1: '#090D16', bg2: '#1E3A8A', accent: '#34D399', emoji: '💻', caption: 'IN THE ZONE', motion: 'wave' },
  { id: 'gif-sparkle', slug: 'sparkle', title: 'Labo Sparkle Star', category: 'Trending', tags: ['star', 'sparkle', 'magic', 'shine', 'art'], bg1: '#312E81', bg2: '#7E22CE', accent: '#FDE047', emoji: '✨', caption: 'ICONIC!', motion: 'spin' },
] as const;

function renderGifDataUrl(spec: (typeof CURATED_GIFS)[number]): string {
  const anim =
    spec.motion === 'bounce'
      ? `<animateTransform attributeName="transform" type="translate" values="0 4; 0 -10; 0 4" dur="0.9s" repeatCount="indefinite" />`
      : spec.motion === 'pulse'
        ? `<animateTransform attributeName="transform" type="scale" values="1; 1.18; 1" dur="0.85s" repeatCount="indefinite" additive="sum" />`
        : spec.motion === 'spin'
          ? `<animateTransform attributeName="transform" type="rotate" values="-12; 12; -12" dur="1.2s" repeatCount="indefinite" />`
          : `<animateTransform attributeName="transform" type="rotate" values="-14; 14; -14" dur="0.7s" repeatCount="indefinite" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${spec.bg1}" />
      <stop offset="100%" stop-color="${spec.bg2}" />
    </linearGradient>
  </defs>
  <rect width="320" height="200" rx="20" fill="url(#bg)" />
  <circle cx="48" cy="40" r="22" fill="${spec.accent}" opacity="0.18"><animate attributeName="r" values="16;28;16" dur="2.1s" repeatCount="indefinite" /></circle>
  <circle cx="272" cy="155" r="26" fill="${spec.accent}" opacity="0.18"><animate attributeName="r" values="20;34;20" dur="1.7s" repeatCount="indefinite" /></circle>
  <rect x="14" y="14" width="38" height="20" rx="10" fill="rgba(15,23,42,0.55)" />
  <text x="33" y="28" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="800" fill="#fff">GIF</text>
  <g transform="translate(160, 92)"><g>${anim}<text x="0" y="14" text-anchor="middle" font-size="68">${spec.emoji}</text></g></g>
  <text x="160" y="172" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="900" letter-spacing="1.5" fill="#fff">${spec.caption}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function handleStaticApi<T>(url: string, options?: RequestInit): Promise<T> {
  const parsedUrl = new URL(url, 'https://sphere.local');
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.searchParams;
  const method = (options?.method || 'GET').toUpperCase();
  const body = options?.body ? JSON.parse(String(options.body)) : {};

  const { db, seedData, lifeGen } = await getStaticDb();
  const { sanitizeUser, sanitizeUsersForViewer } = seedData;

  // 1. HEALTH & TRANSLATE
  if (pathname === '/api/health') {
    return { ok: true, status: 'healthy', mode: 'static-firebase-hosting' } as T;
  }

  // 2. BOOTSTRAP
  if (pathname === '/api/bootstrap' && method === 'GET') {
    const viewerId = (query.get('viewerId') || '').trim();
    if (!viewerId) {
      return {
        users: [],
        posts: [],
        photos: [],
        albums: [],
        marketplace: [],
        groups: [],
        pages: [],
        testimonials: [],
        threads: [],
        anonymousPosts: [],
        verificationRequests: [],
        adCampaigns: [],
        donationDrives: [],
        notifications: [],
        onlineUserIds: [],
        totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
      } as T;
    }

    const friendships = buildFriendshipMap(db);
    const sanitizedUsers = sanitizeUsersForViewer(db, viewerId, friendships);
    const viewer = sanitizedUsers.find((u) => u.id === viewerId);
    if (!viewer) {
      return {
        users: [],
        posts: [],
        photos: [],
        albums: [],
        marketplace: [],
        groups: [],
        pages: [],
        testimonials: [],
        threads: [],
        anonymousPosts: [],
        verificationRequests: [],
        adCampaigns: [],
        donationDrives: [],
        notifications: [],
        onlineUserIds: [],
        totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
      } as T;
    }

    return {
      users: sanitizedUsers,
      posts: db.posts.filter((p) => canViewPost(viewerId, p, sanitizedUsers, friendships)),
      photos: db.photos.filter((ph) => canViewPhoto(viewerId, ph, sanitizedUsers, friendships)),
      albums: db.albums.filter((alb) => canViewAlbum(viewerId, alb, sanitizedUsers, friendships)),
      marketplace: db.marketplace.filter((item) =>
        canSatisfyPrivacy(item.privacy, viewerId, item.sellerId, sanitizedUsers, friendships)
      ),
      groups: db.groups.map((g) => ({
        ...g,
        joined: g.memberIds.includes(viewerId),
        totalMembers: Math.max(g.totalMembers, g.memberIds.length),
      })),
      pages: db.pages.map((p) => ({
        ...p,
        following: p.followerIds.includes(viewerId),
        totalFollowers: Math.max(p.totalFollowers, p.followerIds.length),
      })),
      testimonials: db.testimonials,
      threads: db.threads.filter((t) => t.participantIds.includes(viewerId)),
      anonymousPosts: db.anonymousPosts.filter((a) => !a.hidden),
      verificationRequests:
        viewer.role === 'admin'
          ? db.verificationRequests
          : db.verificationRequests.filter((r) => r.applicantUserId === viewerId),
      adCampaigns: db.adCampaigns.filter(
        (ad) => ad.status === 'approved' || ad.advertiserId === viewerId || viewer.role === 'admin'
      ),
      donationDrives: db.donationDrives,
      notifications: db.notifications.filter((n) => n.recipientId === viewerId),
      onlineUserIds: ['adrian', 'cherry', 'chermaine', 'faye', 'marco-tech', 'clarisse-sw'],
      totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
    } as T;
  }

  // 3. AUTH
  if (pathname === '/api/auth/login' && method === 'POST') {
    const idLower = String(body.identifier || '').trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.id.toLowerCase() === idLower ||
        u.handle.toLowerCase() === idLower ||
        u.handle.replace(/^@/, '').toLowerCase() === idLower ||
        (u.email || '').toLowerCase() === idLower ||
        (u.mobile || '').toLowerCase() === idLower
    );
    if (!user) {
      throw new Error('Account not found. Please verify your email, mobile, or @handle.');
    }
    if (user.password && user.password !== body.password) {
      throw new Error('Incorrect password. Please try again or reset your password.');
    }
    return { user: sanitizeUser(user, user.id, db) } as T;
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    if (!firstName || !lastName) throw new Error('Real first and last name are required.');
    if (!body.privacyConsent || !body.guidelinesConsent) {
      throw new Error('Privacy consent and Community Guidelines agreement are required.');
    }
    if (calculateAge(String(body.birthday || '')) < 18) {
      throw new Error('Members must be at least 18 years old to register on Sphere.');
    }
    const normalizedHandle = `@${String(body.handle || `${firstName}${lastName}`)
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '')}`;
    if (db.users.some((u) => u.handle.toLowerCase() === normalizedHandle)) {
      throw new Error('That @handle is already taken.');
    }
    if (db.users.some((u) => (u.email || '').toLowerCase() === String(body.email || '').trim().toLowerCase())) {
      throw new Error('An account with that email already exists.');
    }
    const newId = `user-${Date.now()}`;
    const fullLocation = body.country
      ? `${String(body.location || '').trim()}, ${body.country}`
      : String(body.location || '').trim();
    const newUser: UserProfile = {
      id: newId,
      role: 'member',
      name: `${firstName} ${lastName}`,
      handle: normalizedHandle,
      avatarColor: '#4F46E5',
      status: 'Just joined Sphere. Looking to connect with genuine people.',
      location: fullLocation || 'Philippines',
      country: body.country || 'Philippines',
      language: body.language || 'English',
      preferredLanguage: body.preferredLanguage || 'English',
      autoTranslate: false,
      interests: ['Community', 'Local Stories'],
      hobbies: [],
      skills: [],
      goals: [],
      categories: ['Lifestyle'],
      quote: 'Real connections matter more than numbers.',
      bio: `New verified member from ${fullLocation || 'Sphere.'}.`,
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      friendCount: 1,
      photoCount: 0,
      groupCount: 0,
      friendship: 'none',
      mutualFriends: 0,
      privacy: 'public',
      taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
      popularitySettings: {
        hidePublicLikeCounts: false,
        hideFollowerCounts: false,
        disableProfileEngagementStats: false,
      },
      sphereIdCategory: 'unverified',
      locationDiscoveryEnabled: true,
      preferredScope: 'nearby',
      email: String(body.email || '').trim(),
      mobile: String(body.mobile || '').trim(),
      password: String(body.password || ''),
      birthday: String(body.birthday || ''),
      gender: String(body.gender || 'Prefer not to say'),
      verified: true,
    };
    db.users.push(newUser);
    db.friendships[newId] = ['adrian'];
    db.friendships.adrian = Array.from(new Set([...(db.friendships.adrian || []), newId]));
    saveStaticDb(db);
    return { user: sanitizeUser(newUser, newId, db) } as T;
  }

  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    throw new Error(
      'Direct unauthenticated password reset is disabled. Use the Account Recovery Center with verified Email, Phone OTP, or Government ID verification.'
    );
  }

  if (pathname === '/api/auth/email-otp/send' && method === 'POST') {
    return {
      sent: true,
      smtpConfigured: false,
      message: 'Use Firebase Email Verification link for free cloud authentication.',
    } as T;
  }

  if (pathname === '/api/auth/email-otp/verify' && method === 'POST') {
    return { verified: true } as T;
  }

  if (pathname === '/api/auth/firebase-session' && method === 'POST') {
    const uid = String(body.uid || '');
    if (!uid) throw new Error('Firebase session UID is required.');
    const normalizedEmail = String(body.email || '').trim().toLowerCase();
    const normalizedPhone = String(body.phoneNumber || '').replace(/[^0-9+]/g, '');

    if (!body.emailVerified && !normalizedPhone && !body.otpVerified) {
      throw new Error('Please verify your email address or phone OTP before signing into Sphere.');
    }

    const user = db.users.find((u) => {
      if (u.firebaseUid && u.firebaseUid === uid) return true;
      if (normalizedEmail && (u.email || '').toLowerCase() === normalizedEmail) return true;
      if (u.id === 'adrian' && normalizedEmail && ADMIN_EMAILS.has(normalizedEmail)) return true;
      if (normalizedPhone && u.mobile) {
        const uDigits = u.mobile.replace(/[^0-9]/g, '').slice(-10);
        const pDigits = normalizedPhone.replace(/[^0-9]/g, '').slice(-10);
        if (uDigits.length >= 9 && uDigits === pDigits) return true;
      }
      return false;
    });

    if (user) {
      user.firebaseUid = uid;
      user.verified = true;
      if (normalizedEmail && !user.email) user.email = normalizedEmail;
      if (normalizedPhone && !user.mobile) user.mobile = normalizedPhone;
      if (normalizedEmail && ADMIN_EMAILS.has(normalizedEmail)) user.role = 'admin';
      saveStaticDb(db);
      return { user: sanitizeUser(user, user.id, db) } as T;
    }

    if (!body.signupDetails) {
      return {
        needsOnboarding: true,
        uid,
        email: normalizedEmail || undefined,
        phoneNumber: normalizedPhone || undefined,
        displayName: body.displayName || undefined,
      } as T;
    }

    const sd = body.signupDetails;
    const firstName = String(sd.firstName || '').trim();
    const lastName = String(sd.lastName || '').trim();
    if (!firstName || !lastName) throw new Error('Real first and last name are required.');
    if (calculateAge(String(sd.birthday || '')) < 18) {
      throw new Error('Members must be at least 18 years old to register on Sphere.');
    }
    const rawHandle = String(sd.handle || `${firstName}${lastName}`)
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '');
    const normalizedHandle = `@${rawHandle || `member${Date.now().toString().slice(-4)}`}`;
    const country = String(sd.country || 'Philippines').trim() || 'Philippines';
    const city = String(sd.location || '').trim();
    const fullLocation = city && !city.toLowerCase().includes(country.toLowerCase()) ? `${city}, ${country}` : city || country;
    const newId = `user-${Date.now()}`;
    const newUser: UserProfile = {
      id: newId,
      firebaseUid: uid,
      role: normalizedEmail && ADMIN_EMAILS.has(normalizedEmail) ? 'admin' : 'member',
      name: `${firstName} ${lastName}`,
      handle: normalizedHandle,
      avatarColor: '#4F46E5',
      status: 'Just joined Sphere. Looking to connect with genuine people.',
      location: fullLocation,
      country,
      language: String(sd.language || 'English'),
      preferredLanguage: String(sd.preferredLanguage || 'English'),
      autoTranslate: true,
      interests: Array.isArray(sd.interests) && sd.interests.length > 0 ? sd.interests : ['Community', 'Local Stories'],
      hobbies: [],
      skills: [],
      goals: [],
      categories: ['Lifestyle'],
      quote: 'Real connections matter more than numbers.',
      bio: `Verified Sphere. member from ${fullLocation}.`,
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      friendCount: 1,
      photoCount: 0,
      groupCount: 0,
      friendship: 'none',
      mutualFriends: 0,
      privacy: 'public',
      taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
      popularitySettings: {
        hidePublicLikeCounts: false,
        hideFollowerCounts: false,
        disableProfileEngagementStats: false,
      },
      sphereIdCategory: 'unverified',
      locationDiscoveryEnabled: true,
      preferredScope: 'global',
      email: normalizedEmail || String(sd.email || '').trim() || undefined,
      mobile: normalizedPhone || String(sd.mobile || '').trim() || undefined,
      birthday: String(sd.birthday || ''),
      gender: String(sd.gender || 'Prefer not to say'),
      verified: true,
    };
    db.users.push(newUser);
    db.friendships[newId] = ['adrian'];
    db.friendships.adrian = Array.from(new Set([...(db.friendships.adrian || []), newId]));
    db.outgoingRequests[newId] = [];
    saveStaticDb(db);
    return { user: sanitizeUser(newUser, newId, db) } as T;
  }

  // 4. DIRECTORY
  if (pathname === '/api/directory' && method === 'GET') {
    const viewerId = query.get('viewerId') || '';
    const page = Math.max(1, Number(query.get('page')) || 1);
    const limit = Math.min(48, Math.max(6, Number(query.get('limit')) || 24));
    const q = query.get('q') || '';
    const country = query.get('country') || 'All';
    const category = (query.get('category') || 'All') as DiscoveryCategory | 'All';
    const viewer = viewerId ? db.users.find((u) => u.id === viewerId) : undefined;
    return queryGlobalDirectory({
      viewer,
      page,
      limit,
      query: q,
      country,
      category,
      friendSet: new Set(viewerId ? db.friendships[viewerId] || [] : []),
      outgoingSet: new Set(viewerId ? db.outgoingRequests[viewerId] || [] : []),
    }) as T;
  }

  if (pathname.startsWith('/api/directory/') && method === 'GET') {
    const id = decodeURIComponent(pathname.replace('/api/directory/', ''));
    const viewerId = query.get('viewerId') || '';
    const existing = db.users.find((u) => u.id === id);
    if (existing) {
      lifeGen.enrichUserLifeDetails(existing);
      return { user: sanitizeUser(existing, viewerId || undefined, db) } as T;
    }
    const virtualUser = getVirtualUserById(id);
    if (!virtualUser) throw new Error('Global member not found.');
    lifeGen.enrichUserLifeDetails(virtualUser);
    return { user: virtualUser } as T;
  }

  // 5. USER ACTIVITY & PROFILE UPDATES
  const activityMatch = pathname.match(/^\/api\/users\/([^/]+)\/activity$/);
  if (activityMatch && method === 'GET') {
    const id = decodeURIComponent(activityMatch[1]);
    const viewerId = (query.get('viewerId') || '').trim();
    const user = ensureUserInDb(db, id);
    if (!user) throw new Error('User not found.');
    const activity = lifeGen.ensureFriendLifeActivity(db, user.id);
    if (activity.changed) saveStaticDb(db);
    const friendships = buildFriendshipMap(db);
    const sanitizedUsers = sanitizeUsersForViewer(db, viewerId || undefined, friendships);
    const sanitizedTarget =
      sanitizedUsers.find((u) => u.id === user.id) || sanitizeUser(user, viewerId || undefined, db);

    return {
      user: sanitizedTarget,
      posts: viewerId
        ? activity.posts.filter((p) => canViewPost(viewerId, p, sanitizedUsers, friendships))
        : activity.posts.filter((p) => (p.privacy || 'public') === 'public'),
      photos: viewerId
        ? activity.photos.filter((ph) => canViewPhoto(viewerId, ph, sanitizedUsers, friendships))
        : activity.photos.filter((ph) => (ph.privacy || 'public') === 'public'),
      albums: viewerId
        ? activity.albums.filter((alb) => canViewAlbum(viewerId, alb, sanitizedUsers, friendships))
        : activity.albums.filter((alb) => (alb.privacy || 'public') === 'public'),
      testimonials: activity.testimonials,
    } as T;
  }

  const friendMatch = pathname.match(/^\/api\/users\/([^/]+)\/friend$/);
  if (friendMatch && method === 'POST') {
    const targetUserId = decodeURIComponent(friendMatch[1]);
    const viewerId = String(body.viewerId || '');
    const action = body.action || 'toggle';
    const target = ensureUserInDb(db, targetUserId);
    const viewer = ensureUserInDb(db, viewerId);
    if (!target || !viewer) throw new Error('User not found.');

    db.friendships[viewerId] = db.friendships[viewerId] || [];
    db.friendships[targetUserId] = db.friendships[targetUserId] || [];
    db.outgoingRequests[viewerId] = db.outgoingRequests[viewerId] || [];
    db.outgoingRequests[targetUserId] = db.outgoingRequests[targetUserId] || [];

    const isFriend = db.friendships[viewerId].includes(targetUserId);
    if (action === 'accept' || (db.outgoingRequests[targetUserId].includes(viewerId) && action !== 'decline')) {
      db.outgoingRequests[targetUserId] = db.outgoingRequests[targetUserId].filter((id) => id !== viewerId);
      db.friendships[viewerId] = Array.from(new Set([...db.friendships[viewerId], targetUserId]));
      db.friendships[targetUserId] = Array.from(new Set([...db.friendships[targetUserId], viewerId]));
    } else if (action === 'decline') {
      db.outgoingRequests[targetUserId] = db.outgoingRequests[targetUserId].filter((id) => id !== viewerId);
    } else if (isFriend) {
      db.friendships[viewerId] = db.friendships[viewerId].filter((id) => id !== targetUserId);
      db.friendships[targetUserId] = db.friendships[targetUserId].filter((id) => id !== viewerId);
    } else if (db.outgoingRequests[viewerId].includes(targetUserId)) {
      db.outgoingRequests[viewerId] = db.outgoingRequests[viewerId].filter((id) => id !== targetUserId);
    } else {
      db.friendships[viewerId] = Array.from(new Set([...db.friendships[viewerId], targetUserId]));
      db.friendships[targetUserId] = Array.from(new Set([...db.friendships[targetUserId], viewerId]));
    }
    saveStaticDb(db);
    return {
      ok: true,
      friendship: sanitizeUser(target, viewerId, db).friendship,
    } as T;
  }

  const userPatchMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userPatchMatch && method === 'PATCH') {
    const id = decodeURIComponent(userPatchMatch[1]);
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found.');
    Object.assign(user, body);
    saveStaticDb(db);
    return { user: sanitizeUser(user, user.id, db) } as T;
  }

  // 6. UPLOAD (Convert base64 to browser data URL cleanly)
  if (pathname === '/api/upload' && method === 'POST') {
    const mimeType = String(body.mimeType || 'image/png');
    const cleanB64 = String(body.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    return {
      url: `data:${mimeType};base64,${cleanB64}`,
      mimeType,
      sizeBytes: Math.round((cleanB64.length * 3) / 4),
      name: String(body.fileName || 'upload'),
    } as T;
  }

  // 7. POSTS
  if (pathname === '/api/posts' && method === 'POST') {
    const safe = checkSafeContent(String(body.content || ''));
    if (!safe.ok) throw new Error(safe.reason || 'Content violates safety guidelines.');
    const author = db.users.find((u) => u.id === body.authorId);
    if (!author) throw new Error('Author not found.');

    let createdPhoto: PhotoItem | undefined;
    if (body.photoSrc) {
      createdPhoto = {
        id: `ph-${Date.now()}`,
        ownerId: author.id,
        albumId: body.albumId || undefined,
        pageId: body.pageId || undefined,
        postAsPage: Boolean(body.postAsPage),
        src: body.photoSrc,
        caption: body.photoCaption || body.content,
        location: body.location || author.location,
        album: 'Timeline Uploads',
        createdAt: 'Just now',
        likes: [],
        reactions: {},
        comments: [],
        privacy: (body.privacy || 'public') as PrivacyLevel,
      };
      db.photos.unshift(createdPhoto);
    }

    const tagged = Array.isArray(body.taggedUserIds) ? (body.taggedUserIds as string[]) : [];
    const approvedTagUserIds: string[] = [];
    const pendingTagUserIds: string[] = [];
    const friendshipsMap = buildFriendshipMap(db);
    for (const tid of tagged) {
      const targetUser = db.users.find((u) => u.id === tid);
      const tagRes = targetUser ? canTagUser(author.id, targetUser, db.users, friendshipsMap) : null;
      if (targetUser && tagRes?.allowed) {
        if (tagRes.requiresApproval) pendingTagUserIds.push(tid);
        else approvedTagUserIds.push(tid);
      }
    }

    let wallApproved = true;
    if (body.targetProfileId && body.targetProfileId !== author.id) {
      const targetUser = db.users.find((u) => u.id === body.targetProfileId);
      if (targetUser) {
        const wallRes = canPostOnWall(author.id, targetUser, db.users, friendshipsMap);
        if (!wallRes.allowed) {
          throw new Error(wallRes.reason || 'This user restricts wall posting.');
        }
        wallApproved = !wallRes.requiresApproval;
      }
    }

    const post: SocialPost = {
      id: `post-${Date.now()}`,
      authorId: author.id,
      content: String(body.content || '').trim(),
      location: body.location || author.location,
      country: body.country || author.country,
      language: author.language?.split('&')[0]?.trim() || 'English',
      createdAt: 'Just now',
      likes: [],
      reactions: {},
      comments: [],
      photoId: createdPhoto?.id,
      sharesCount: 0,
      privacy: (body.privacy || 'public') as PrivacyLevel,
      vibe: body.vibe,
      targetProfileId: body.targetProfileId,
      wallApproved,
      taggedUserIds: tagged,
      approvedTagUserIds,
      pendingTagUserIds,
      groupId: body.groupId,
      pageId: body.pageId,
      postAsPage: Boolean(body.postAsPage),
      video: body.video ? { ...body.video } : undefined,
    };
    db.posts.unshift(post);
    saveStaticDb(db);
    return { post, photo: createdPhoto } as T;
  }

  const postDeleteMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (postDeleteMatch && method === 'DELETE') {
    const id = decodeURIComponent(postDeleteMatch[1]);
    db.posts = db.posts.filter((p) => p.id !== id);
    saveStaticDb(db);
    return { ok: true } as T;
  }

  const postAudienceMatch = pathname.match(/^\/api\/posts\/([^/]+)\/audience$/);
  if (postAudienceMatch && method === 'PATCH') {
    const id = decodeURIComponent(postAudienceMatch[1]);
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error('Post not found.');
    post.privacy = body.privacy;
    saveStaticDb(db);
    return { post } as T;
  }

  const postReactMatch = pathname.match(/^\/api\/posts\/([^/]+)\/react$/);
  if (postReactMatch && method === 'POST') {
    const id = decodeURIComponent(postReactMatch[1]);
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error('Post not found.');
    const result = applyReactionRules({
      userId: String(body.userId),
      reactionType: body.reactionType as ReactionType,
      reactions: post.reactions,
      tracker: post.reactionTracker,
      likes: post.likes,
    });
    if (!result.ok) throw new Error(result.error || 'Could not react.');
    post.reactions = result.reactions;
    post.reactionTracker = result.tracker;
    post.likes = result.likes;
    saveStaticDb(db);
    return { post, switchesRemaining: result.switchesRemaining } as T;
  }

  const postCommentsMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
  if (postCommentsMatch && method === 'POST') {
    const id = decodeURIComponent(postCommentsMatch[1]);
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error('Post not found.');
    const safe = checkSafeContent(String(body.text || ''));
    if (!safe.ok) throw new Error(safe.reason || 'Comment blocked.');
    const comment = {
      id: `pc-${Date.now()}`,
      authorId: String(body.authorId),
      text: String(body.text).trim(),
      createdAt: 'Just now',
      likes: 0,
      reactions: {},
    };
    post.comments.push(comment);
    saveStaticDb(db);
    return { comment, post } as T;
  }

  const commentReactMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments\/([^/]+)\/react$/);
  if (commentReactMatch && method === 'POST') {
    const post = db.posts.find((p) => p.id === decodeURIComponent(commentReactMatch[1]));
    const comment = post?.comments.find((c) => c.id === decodeURIComponent(commentReactMatch[2]));
    if (!post || !comment) throw new Error('Comment not found.');
    const result = applyReactionRules({
      userId: String(body.userId),
      reactionType: body.reactionType as ReactionType,
      reactions: comment.reactions,
      tracker: comment.reactionTracker,
    });
    if (!result.ok) throw new Error(result.error || 'Could not react.');
    comment.reactions = result.reactions;
    comment.reactionTracker = result.tracker;
    comment.likes = result.likes.length;
    saveStaticDb(db);
    return { post, switchesRemaining: result.switchesRemaining } as T;
  }

  const postShareMatch = pathname.match(/^\/api\/posts\/([^/]+)\/share$/);
  if (postShareMatch && method === 'POST') {
    const original = db.posts.find((p) => p.id === decodeURIComponent(postShareMatch[1]));
    if (!original) throw new Error('Post not found.');
    original.sharesCount += 1;
    const shared: SocialPost = {
      id: `post-share-${Date.now()}`,
      authorId: String(body.authorId),
      content: String(body.commentary || 'Shared from Sphere community.'),
      createdAt: 'Just now',
      likes: [],
      reactions: {},
      comments: [],
      sharesCount: 0,
      sharedPostId: original.id,
      privacy: (body.privacy || 'public') as PrivacyLevel,
    };
    db.posts.unshift(shared);
    saveStaticDb(db);
    return { post: shared } as T;
  }

  const tagDecisionMatch = pathname.match(/^\/api\/posts\/([^/]+)\/(tag-decision|remove-tag)$/);
  if (tagDecisionMatch && method === 'POST') {
    const post = db.posts.find((p) => p.id === decodeURIComponent(tagDecisionMatch[1]));
    if (!post) throw new Error('Post not found.');
    const uid = String(body.userId);
    post.pendingTagUserIds = (post.pendingTagUserIds || []).filter((id) => id !== uid);
    if (body.decision === 'approve') {
      post.approvedTagUserIds = Array.from(new Set([...(post.approvedTagUserIds || []), uid]));
    } else {
      post.approvedTagUserIds = (post.approvedTagUserIds || []).filter((id) => id !== uid);
      post.taggedUserIds = (post.taggedUserIds || []).filter((id) => id !== uid);
    }
    saveStaticDb(db);
    return { post } as T;
  }

  const wallDecisionMatch = pathname.match(/^\/api\/posts\/([^/]+)\/wall-decision$/);
  if (wallDecisionMatch && method === 'POST') {
    const id = decodeURIComponent(wallDecisionMatch[1]);
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new Error('Post not found.');
    if (body.decision === 'approve') {
      post.wallApproved = true;
      saveStaticDb(db);
      return { ok: true, post } as T;
    }
    db.posts = db.posts.filter((p) => p.id !== id);
    saveStaticDb(db);
    return { ok: true } as T;
  }

  // 8. ALBUMS & PHOTOS
  if (pathname === '/api/albums' && method === 'POST') {
    const album: AlbumItem = {
      id: `alb-${Date.now()}`,
      ownerId: String(body.ownerId),
      name: String(body.name).trim(),
      description: String(body.description || ''),
      privacy: body.privacy || 'public',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    db.albums.unshift(album);
    saveStaticDb(db);
    return { album } as T;
  }

  const albumPatchMatch = pathname.match(/^\/api\/albums\/([^/]+)$/);
  if (albumPatchMatch && method === 'PATCH') {
    const album = db.albums.find((a) => a.id === decodeURIComponent(albumPatchMatch[1]));
    if (!album) throw new Error('Album not found.');
    Object.assign(album, body, { updatedAt: new Date().toISOString().slice(0, 10) });
    saveStaticDb(db);
    return { album } as T;
  }
  if (albumPatchMatch && method === 'DELETE') {
    const id = decodeURIComponent(albumPatchMatch[1]);
    db.albums = db.albums.filter((a) => a.id !== id);
    if (query.get('deleteMedia') === 'true') {
      db.photos = db.photos.filter((p) => p.albumId !== id);
    }
    saveStaticDb(db);
    return { ok: true } as T;
  }

  if (pathname === '/api/photos' && method === 'POST') {
    const created: PhotoItem[] = (Array.isArray(body.items) ? body.items : []).map(
      (item: { src: string; caption: string; mediaType?: 'image' | 'video'; videoFormat?: VideoFormat }, idx: number) => ({
        id: `ph-${Date.now()}-${idx}`,
        ownerId: String(body.ownerId),
        albumId: body.albumId || undefined,
        src: item.src,
        caption: item.caption || '',
        location: body.location || 'Philippines',
        mediaType: item.mediaType,
        videoFormat: item.videoFormat,
        createdAt: 'Just now',
        likes: [],
        reactions: {},
        comments: [],
        privacy: body.privacy || 'public',
      })
    );
    db.photos.unshift(...created);
    saveStaticDb(db);
    return { photos: created } as T;
  }

  const photoItemMatch = pathname.match(/^\/api\/photos\/([^/]+)$/);
  if (photoItemMatch && method === 'PATCH') {
    const photo = db.photos.find((p) => p.id === decodeURIComponent(photoItemMatch[1]));
    if (!photo) throw new Error('Photo not found.');
    Object.assign(photo, body);
    saveStaticDb(db);
    return { photo } as T;
  }
  if (photoItemMatch && method === 'DELETE') {
    const id = decodeURIComponent(photoItemMatch[1]);
    db.photos = db.photos.filter((p) => p.id !== id);
    saveStaticDb(db);
    return { ok: true } as T;
  }

  const photoReactMatch = pathname.match(/^\/api\/photos\/([^/]+)\/react$/);
  if (photoReactMatch && method === 'POST') {
    const photo = db.photos.find((p) => p.id === decodeURIComponent(photoReactMatch[1]));
    if (!photo) throw new Error('Photo not found.');
    const res = applyReactionRules({
      userId: String(body.userId),
      reactionType: body.reactionType as ReactionType,
      reactions: photo.reactions,
      tracker: photo.reactionTracker,
      likes: photo.likes,
    });
    if (!res.ok) throw new Error(res.error || 'Could not react.');
    photo.reactions = res.reactions;
    photo.reactionTracker = res.tracker;
    photo.likes = res.likes;
    saveStaticDb(db);
    return { photo, switchesRemaining: res.switchesRemaining } as T;
  }

  const photoCommentMatch = pathname.match(/^\/api\/photos\/([^/]+)\/comments$/);
  if (photoCommentMatch && method === 'POST') {
    const photo = db.photos.find((p) => p.id === decodeURIComponent(photoCommentMatch[1]));
    if (!photo) throw new Error('Photo not found.');
    photo.comments.push({
      id: `phc-${Date.now()}`,
      authorId: String(body.authorId),
      text: String(body.text).trim(),
      createdAt: 'Just now',
      likes: 0,
      reactions: {},
    });
    saveStaticDb(db);
    return { photo } as T;
  }

  // 9. MARKETPLACE
  if (pathname === '/api/marketplace' && method === 'POST') {
    const item: MarketplaceItem = {
      id: `mkt-${Date.now()}`,
      sellerId: String(body.sellerId),
      title: String(body.title).trim(),
      price: Number(body.price || 0),
      currency: 'PHP',
      category: String(body.category || 'Local Goods'),
      condition: body.condition || 'Brand New',
      location: String(body.location || 'Philippines'),
      description: String(body.description || ''),
      imageSrc: body.imageSrc,
      createdAt: 'Just now',
      privacy: body.privacy || 'public',
      sold: false,
      allowCommentsAndReactions: body.allowCommentsAndReactions !== false,
      reactions: {},
      comments: [],
    };
    db.marketplace.unshift(item);
    saveStaticDb(db);
    return { item } as T;
  }

  const mktSoldMatch = pathname.match(/^\/api\/marketplace\/([^/]+)\/toggle-sold$/);
  if (mktSoldMatch && method === 'POST') {
    const item = db.marketplace.find((m) => m.id === decodeURIComponent(mktSoldMatch[1]));
    if (!item) throw new Error('Item not found.');
    item.sold = !item.sold;
    saveStaticDb(db);
    return { item } as T;
  }

  const mktReactMatch = pathname.match(/^\/api\/marketplace\/([^/]+)\/react$/);
  if (mktReactMatch && method === 'POST') {
    const item = db.marketplace.find((m) => m.id === decodeURIComponent(mktReactMatch[1]));
    if (!item) throw new Error('Item not found.');
    const res = applyReactionRules({
      userId: String(body.userId),
      reactionType: body.reactionType as ReactionType,
      reactions: item.reactions,
      tracker: item.reactionTracker,
    });
    if (!res.ok) throw new Error(res.error || 'Could not react.');
    item.reactions = res.reactions;
    item.reactionTracker = res.tracker;
    saveStaticDb(db);
    return { item, switchesRemaining: res.switchesRemaining } as T;
  }

  const mktCommentMatch = pathname.match(/^\/api\/marketplace\/([^/]+)\/comments$/);
  if (mktCommentMatch && method === 'POST') {
    const item = db.marketplace.find((m) => m.id === decodeURIComponent(mktCommentMatch[1]));
    if (!item) throw new Error('Item not found.');
    (item.comments ||= []).push({
      id: `mc-${Date.now()}`,
      authorId: String(body.authorId),
      text: String(body.text).trim(),
      createdAt: 'Just now',
      likes: 0,
      reactions: {},
    });
    saveStaticDb(db);
    return { item } as T;
  }

  // 10. PAGES, GROUPS, TESTIMONIALS
  if (pathname === '/api/pages' && method === 'POST') {
    const preset = getCategoryGuidelines(body.category || 'Community');
    const page: PageItem = {
      id: `page-${Date.now()}`,
      name: String(body.name).trim(),
      handle: `@${String(body.handle || body.name).replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '')}`,
      category: String(body.category || 'Community'),
      description: String(body.description || ''),
      location: String(body.location || 'Philippines'),
      ownerId: String(body.ownerId),
      accentColor: '#4F46E5',
      followerIds: [String(body.ownerId)],
      following: true,
      totalFollowers: 1,
      verified: true,
      rules: body.rules?.length ? body.rules : preset.rules,
      postingPolicy: body.postingPolicy || preset.postingPolicy,
      guidelinesSummary: body.guidelinesSummary || preset.guidelinesSummary,
    };
    db.pages.unshift(page);
    saveStaticDb(db);
    return { page } as T;
  }

  const pageRulesMatch = pathname.match(/^\/api\/pages\/([^/]+)\/rules$/);
  if (pageRulesMatch && method === 'PATCH') {
    const page = db.pages.find((p) => p.id === decodeURIComponent(pageRulesMatch[1]));
    if (!page) throw new Error('Page not found.');
    page.rules = body.rules;
    page.postingPolicy = body.postingPolicy;
    page.guidelinesSummary = body.guidelinesSummary;
    saveStaticDb(db);
    return { page } as T;
  }

  const pageFollowMatch = pathname.match(/^\/api\/pages\/([^/]+)\/follow$/);
  if (pageFollowMatch && method === 'POST') {
    const page = db.pages.find((p) => p.id === decodeURIComponent(pageFollowMatch[1]));
    if (!page) throw new Error('Page not found.');
    const uid = String(body.userId);
    if (page.followerIds.includes(uid)) {
      page.followerIds = page.followerIds.filter((id) => id !== uid);
      page.following = false;
      page.totalFollowers = Math.max(0, page.totalFollowers - 1);
    } else {
      page.followerIds.push(uid);
      page.following = true;
      page.totalFollowers += 1;
    }
    saveStaticDb(db);
    return { page } as T;
  }

  if (pathname === '/api/groups' && method === 'POST') {
    const preset = getCategoryGuidelines(body.category || 'Community', true);
    const group: GroupItem = {
      id: `grp-${Date.now()}`,
      name: String(body.name).trim(),
      category: String(body.category || 'Community'),
      description: String(body.description || ''),
      location: String(body.location || 'Philippines'),
      privacy: body.privacy || 'public',
      creatorId: String(body.creatorId),
      accentColor: '#4F46E5',
      memberIds: [String(body.creatorId)],
      joined: true,
      totalMembers: 1,
      rules: body.rules?.length ? body.rules : preset.rules,
      postingPolicy: body.postingPolicy || preset.postingPolicy,
      guidelinesSummary: body.guidelinesSummary || preset.guidelinesSummary,
    };
    db.groups.unshift(group);
    saveStaticDb(db);
    return { group } as T;
  }

  const groupRulesMatch = pathname.match(/^\/api\/groups\/([^/]+)\/rules$/);
  if (groupRulesMatch && method === 'PATCH') {
    const group = db.groups.find((g) => g.id === decodeURIComponent(groupRulesMatch[1]));
    if (!group) throw new Error('Circle not found.');
    group.rules = body.rules;
    group.postingPolicy = body.postingPolicy;
    group.guidelinesSummary = body.guidelinesSummary;
    saveStaticDb(db);
    return { group } as T;
  }

  const groupJoinMatch = pathname.match(/^\/api\/groups\/([^/]+)\/join$/);
  if (groupJoinMatch && method === 'POST') {
    const group = db.groups.find((g) => g.id === decodeURIComponent(groupJoinMatch[1]));
    if (!group) throw new Error('Circle not found.');
    const uid = String(body.userId);
    if (group.memberIds.includes(uid)) {
      group.memberIds = group.memberIds.filter((id) => id !== uid);
      group.joined = false;
      group.totalMembers = Math.max(0, group.totalMembers - 1);
    } else {
      group.memberIds.push(uid);
      group.joined = true;
      group.totalMembers += 1;
    }
    saveStaticDb(db);
    return { group } as T;
  }

  if (pathname === '/api/testimonials' && method === 'POST') {
    const testimonial: TestimonialItem = {
      id: `test-${Date.now()}`,
      authorId: String(body.authorId),
      recipientId: String(body.recipientId),
      quote: String(body.quote).trim(),
      createdAt: 'Just now',
    };
    db.testimonials.unshift(testimonial);
    saveStaticDb(db);
    return { testimonial } as T;
  }

  // 11. MESSAGES, GROUP CHATS & GIF SEARCH
  if (pathname === '/api/messages/thread' && method === 'POST') {
    const participantIds = Array.isArray(body.participantIds) ? body.participantIds.map(String) : [];
    const sortedKey = [...participantIds].sort().join(',');
    let thread = db.threads.find(
      (t) => !t.isGroup && [...t.participantIds].sort().join(',') === sortedKey
    );
    if (!thread) {
      thread = {
        id: `thr-${Date.now()}`,
        participantIds,
        title: body.title,
        unreadCount: 0,
        messages: [],
      };
      db.threads.unshift(thread);
      saveStaticDb(db);
    }
    return { thread } as T;
  }

  if (pathname === '/api/messages/group' && method === 'POST') {
    const capacity = Math.max(1000, Math.min(10000, Number(body.maxMembers) || 2000));
    const uniqueIds = new Set<string>([String(body.creatorId), ...(body.participantIds || []).map(String)]);
    const requestedBulk = Math.max(0, Math.min(capacity - uniqueIds.size, Number(body.autoAddCount) || 0));
    if (requestedBulk > 0) {
      for (const sid of sampleGlobalMemberIds({
        count: requestedBulk,
        country: typeof body.autoAddCountry === 'string' ? body.autoAddCountry : 'All',
        category: (body.autoAddCategory as DiscoveryCategory | 'All') || 'All',
        excludeIds: uniqueIds,
      })) {
        uniqueIds.add(sid);
      }
    }
    const finalIds = Array.from(uniqueIds).slice(0, capacity);
    const thread: MessageThread = {
      id: `grp-thr-${Date.now()}`,
      participantIds: finalIds,
      title: String(body.title || 'Group Chat').trim().slice(0, 80),
      isGroup: true,
      avatar: body.avatar,
      avatarColor: body.avatarColor || '#4F46E5',
      adminIds: [String(body.creatorId)],
      maxMembers: capacity,
      unreadCount: 0,
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: String(body.creatorId),
          text: `Created "${String(body.title)}" (${finalIds.length.toLocaleString()} members · Max ${capacity.toLocaleString()}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: 'English',
          reactions: {},
          deliveredTo: [],
          readBy: [String(body.creatorId)],
        },
      ],
    };
    db.threads.unshift(thread);
    saveStaticDb(db);
    return { thread } as T;
  }

  const thrSettingsMatch = pathname.match(/^\/api\/messages\/([^/]+)\/settings$/);
  if (thrSettingsMatch && method === 'PATCH') {
    const thread = db.threads.find((t) => t.id === decodeURIComponent(thrSettingsMatch[1]));
    if (!thread) throw new Error('Group conversation not found.');
    if (body.title) thread.title = String(body.title).trim().slice(0, 80);
    if (body.avatar !== undefined) thread.avatar = body.avatar || undefined;
    if (body.avatarColor) thread.avatarColor = body.avatarColor;
    saveStaticDb(db);
    return { thread } as T;
  }

  const thrMembersMatch = pathname.match(/^\/api\/messages\/([^/]+)\/members$/);
  if (thrMembersMatch && method === 'POST') {
    const thread = db.threads.find((t) => t.id === decodeURIComponent(thrMembersMatch[1]));
    if (!thread) throw new Error('Conversation not found.');
    const capacity = Math.max(1000, thread.maxMembers || 2000);
    const existingSet = new Set(thread.participantIds);
    for (const mid of body.memberIds || []) existingSet.add(String(mid));
    const bulk = Math.max(0, Math.min(capacity - existingSet.size, Number(body.autoAddCount) || 0));
    if (bulk > 0) {
      for (const sid of sampleGlobalMemberIds({
        count: bulk,
        country: typeof body.autoAddCountry === 'string' ? body.autoAddCountry : 'All',
        category: (body.autoAddCategory as DiscoveryCategory | 'All') || 'All',
        excludeIds: existingSet,
      })) {
        existingSet.add(sid);
      }
    }
    thread.participantIds = Array.from(existingSet);
    saveStaticDb(db);
    return { thread } as T;
  }
  if (thrMembersMatch && method === 'GET') {
    const thread = db.threads.find((t) => t.id === decodeURIComponent(thrMembersMatch[1]));
    if (!thread) throw new Error('Conversation not found.');
    const page = Math.max(1, Number(query.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(query.get('limit')) || 40));
    const q = (query.get('q') || '').trim().toLowerCase();
    const userMap = new Map(db.users.map((u) => [u.id, u]));
    const resolved = [];
    for (const pid of thread.participantIds) {
      const profile = userMap.get(pid) || getVirtualUserById(pid);
      if (!profile) continue;
      if (q && !profile.name.toLowerCase().includes(q) && !profile.handle.toLowerCase().includes(q)) continue;
      resolved.push({
        id: profile.id,
        name: profile.name,
        handle: profile.handle,
        location: profile.location,
        avatar: profile.avatar,
        avatarColor: profile.avatarColor,
        online: pid === 'adrian' || pid === 'cherry',
        isAdmin: (thread.adminIds || []).includes(profile.id),
      });
    }
    const start = (page - 1) * limit;
    return {
      totalMembers: thread.participantIds.length,
      matchedCount: resolved.length,
      maxMembers: Math.max(1000, thread.maxMembers || 2000),
      page,
      limit,
      members: resolved.slice(start, start + limit),
    } as T;
  }

  const thrSendMatch = pathname.match(/^\/api\/messages\/([^/]+)\/send$/);
  if (thrSendMatch && method === 'POST') {
    const thread = db.threads.find((t) => t.id === decodeURIComponent(thrSendMatch[1]));
    if (!thread) throw new Error('Conversation not found.');
    thread.messages.push({
      id: `msg-${Date.now()}`,
      senderId: String(body.senderId),
      text: String(body.text || '').trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sharedPostId: body.sharedPostId,
      language: 'English',
      attachments: Array.isArray(body.attachments) ? (body.attachments as AttachmentItem[]) : undefined,
      reactions: {},
      deliveredTo: [],
      readBy: [],
    });
    thread.unreadCount += 1;
    saveStaticDb(db);
    return { thread } as T;
  }

  const thrReadMatch = pathname.match(/^\/api\/messages\/([^/]+)\/read$/);
  if (thrReadMatch && method === 'POST') {
    const thread = db.threads.find((t) => t.id === decodeURIComponent(thrReadMatch[1]));
    if (!thread) throw new Error('Conversation not found.');
    thread.unreadCount = 0;
    saveStaticDb(db);
    return { thread } as T;
  }

  const thrReactMatch = pathname.match(/^\/api\/messages\/([^/]+)\/react$/);
  if (thrReactMatch && method === 'POST') {
    const thread = db.threads.find((t) => t.id === decodeURIComponent(thrReactMatch[1]));
    const msg = thread?.messages.find((m) => m.id === body.messageId);
    if (!thread || !msg) throw new Error('Message not found.');
    msg.reactions = msg.reactions || {};
    if (msg.reactions[body.userId] === body.emoji) delete msg.reactions[body.userId];
    else msg.reactions[body.userId] = String(body.emoji);
    saveStaticDb(db);
    return { thread } as T;
  }

  if (pathname === '/api/gifs/search' && method === 'GET') {
    const q = (query.get('q') || '').trim().toLowerCase();
    const category = (query.get('category') || 'All').trim();
    const items = CURATED_GIFS.filter((g) => {
      if (category && category !== 'All' && category !== 'Trending' && g.category !== category) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.caption.toLowerCase().includes(q) ||
        g.tags.some((t) => t.includes(q))
      );
    }).map((g) => {
      const dataUrl = renderGifDataUrl(g);
      return { id: g.id, title: g.title, url: dataUrl, previewUrl: dataUrl, category: g.category };
    });
    return {
      items,
      categories: ['All', 'Trending', 'Reactions', 'Celebration', 'Tech & Gaming', 'Pinoy Vibes'],
    } as T;
  }

  // 12. LIVESTREAMS, ADS, DONATIONS, VERIFICATION, ANONYMOUS, NOTIFICATIONS
  if (pathname === '/api/livestreams/start' && method === 'POST') {
    const post: SocialPost = {
      id: `live-${Date.now()}`,
      authorId: String(body.authorId),
      content: String(body.title || 'Live broadcast on Sphere'),
      location: body.location || 'Labo, Camarines Norte',
      createdAt: 'LIVE NOW',
      likes: [],
      reactions: {},
      comments: [],
      sharesCount: 0,
      privacy: (body.privacy || 'public') as PrivacyLevel,
      liveStream: {
        id: `stream-${Date.now()}`,
        isLive: true,
        title: String(body.title || 'Live Broadcast'),
        viewerCount: 14,
        durationLabel: 'LIVE',
        chatMessages: [],
      },
    };
    db.posts.unshift(post);
    saveStaticDb(db);
    return { post } as T;
  }

  const liveChatMatch = pathname.match(/^\/api\/livestreams\/([^/]+)\/chat$/);
  if (liveChatMatch && method === 'POST') {
    const post = db.posts.find((p) => p.id === decodeURIComponent(liveChatMatch[1]));
    if (!post?.liveStream) throw new Error('Stream not found.');
    const chatMessage: LiveStreamComment = {
      id: `lc-${Date.now()}`,
      authorId: String(body.authorId),
      text: String(body.text),
      timestamp: 'Just now',
    };
    post.liveStream.chatMessages.push(chatMessage);
    saveStaticDb(db);
    return { chatMessage, post } as T;
  }

  const liveEndMatch = pathname.match(/^\/api\/livestreams\/([^/]+)\/end$/);
  if (liveEndMatch && method === 'POST') {
    const post = db.posts.find((p) => p.id === decodeURIComponent(liveEndMatch[1]));
    if (!post?.liveStream) throw new Error('Stream not found.');
    post.liveStream.isLive = false;
    post.liveStream.durationLabel = String(body.durationLabel || 'Ended');
    saveStaticDb(db);
    return { post } as T;
  }

  if (pathname === '/api/ads' && method === 'POST') {
    const campaign: AdCampaign = {
      id: `ad-${Date.now()}`,
      advertiserId: String(body.advertiserId),
      postId: String(body.postId),
      title: String(body.title),
      objective: (body.objective || 'reach') as AdObjective,
      destinationUrl: body.destinationUrl,
      targetCountries: body.targetCountries || ['Philippines'],
      targetLocations: body.targetLocations || ['Labo'],
      targetInterests: body.targetInterests || [],
      targetAgeMin: Number(body.targetAgeMin || 18),
      targetAgeMax: Number(body.targetAgeMax || 65),
      dailyBudgetPhp: Number(body.dailyBudgetPhp || 200),
      durationDays: Number(body.durationDays || 7),
      estimatedReachMin: 800,
      estimatedReachMax: 2400,
      status: 'pending_review',
      billingStatus: 'awaiting_payment_setup',
      impressions: 0,
      uniqueViewerIds: [],
      clicks: 0,
      engagements: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    db.adCampaigns.unshift(campaign);
    saveStaticDb(db);
    return { campaign } as T;
  }

  const adModerateMatch = pathname.match(/^\/api\/ads\/([^/]+)\/moderate$/);
  if (adModerateMatch && method === 'POST') {
    const campaign = db.adCampaigns.find((a) => a.id === decodeURIComponent(adModerateMatch[1]));
    if (!campaign) throw new Error('Campaign not found.');
    campaign.status = body.status as AdStatus;
    campaign.moderationNote = body.moderationNote;
    saveStaticDb(db);
    return { campaign } as T;
  }

  const adTrackMatch = pathname.match(/^\/api\/ads\/([^/]+)\/track$/);
  if (adTrackMatch && method === 'POST') {
    const campaign = db.adCampaigns.find((a) => a.id === decodeURIComponent(adTrackMatch[1]));
    if (!campaign) throw new Error('Campaign not found.');
    if (body.event === 'impression') campaign.impressions += 1;
    if (body.event === 'click') campaign.clicks += 1;
    if (body.event === 'engagement') campaign.engagements += 1;
    saveStaticDb(db);
    return { campaign } as T;
  }

  if (pathname === '/api/donations' && method === 'POST') {
    const org = db.users.find((u) => u.id === body.organizerId);
    const drive: DonationDrive = {
      id: `drive-${Date.now()}`,
      organizerId: String(body.organizerId),
      organizerName: org?.name || 'Verified Organization',
      govAgency: org?.govAgency || 'DSWD',
      govRegNumber: org?.govRegNumber || 'VERIFIED',
      title: String(body.title),
      description: String(body.description),
      location: String(body.location),
      category: body.category || 'Community Relief',
      goalAmountPhp: Number(body.goalAmountPhp || 10000),
      raisedAmountPhp: 0,
      verifiedGov: true,
      status: 'active',
      pledges: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    db.donationDrives.unshift(drive);
    saveStaticDb(db);
    return { drive } as T;
  }

  const pledgeMatch = pathname.match(/^\/api\/donations\/([^/]+)\/pledge$/);
  if (pledgeMatch && method === 'POST') {
    const drive = db.donationDrives.find((d) => d.id === decodeURIComponent(pledgeMatch[1]));
    const donor = db.users.find((u) => u.id === body.donorId);
    if (!drive) throw new Error('Drive not found.');
    const amount = Number(body.amountPhp || 0);
    drive.raisedAmountPhp += amount;
    drive.pledges.unshift({
      id: `plg-${Date.now()}`,
      donorId: String(body.donorId),
      donorName: donor?.name || 'Community Member',
      amountPhp: amount,
      note: String(body.note || ''),
      createdAt: 'Just now',
    });
    saveStaticDb(db);
    return { drive } as T;
  }

  if (pathname === '/api/verification-requests' && method === 'POST') {
    const applicant = db.users.find((u) => u.id === body.applicantUserId);
    const request: SphereIdVerificationRequest = {
      id: `ver-${Date.now()}`,
      applicantUserId: String(body.applicantUserId),
      applicantName: applicant?.name || String(body.entityName),
      category: body.category,
      entityName: String(body.entityName),
      country: String(body.country),
      publicLink: String(body.publicLink || ''),
      govAgency: body.govAgency,
      govRegNumber: body.govRegNumber,
      notes: String(body.notes || ''),
      documentSummary: body.documentSummary,
      status: 'pending',
      submittedAt: new Date().toISOString().slice(0, 10),
    };
    db.verificationRequests.unshift(request);
    saveStaticDb(db);
    return { request } as T;
  }

  const verReviewMatch = pathname.match(/^\/api\/verification-requests\/([^/]+)\/review$/);
  if (verReviewMatch && method === 'POST') {
    const request = db.verificationRequests.find((r) => r.id === decodeURIComponent(verReviewMatch[1]));
    if (!request) throw new Error('Request not found.');
    request.status = body.decision;
    request.reviewNote = body.reviewNote;
    request.reviewedAt = new Date().toISOString().slice(0, 10);
    const applicant = db.users.find((u) => u.id === request.applicantUserId);
    if (applicant && body.decision === 'approved') {
      applicant.sphereIdCategory = request.category;
      applicant.verified = true;
    }
    saveStaticDb(db);
    return { request, user: applicant } as T;
  }

  if (pathname === '/api/anonymous' && method === 'POST') {
    const post: AnonymousPost = {
      id: `anon-${Date.now()}`,
      topic: (body.topic || 'Community Concerns') as AnonymousTopic,
      alias: generateAnonymousAlias(`anon-${Date.now()}`),
      authorId: String(body.authorId),
      title: String(body.title),
      content: String(body.content),
      createdAt: 'Just now',
      language: 'English',
      supportiveVotes: [],
      replies: [],
      reports: [],
    };
    db.anonymousPosts.unshift(post);
    saveStaticDb(db);
    return { post } as T;
  }

  const anonReplyMatch = pathname.match(/^\/api\/anonymous\/([^/]+)\/reply$/);
  if (anonReplyMatch && method === 'POST') {
    const post = db.anonymousPosts.find((a) => a.id === decodeURIComponent(anonReplyMatch[1]));
    if (!post) throw new Error('Anonymous thread not found.');
    post.replies.push({
      id: `ar-${Date.now()}`,
      alias: generateAnonymousAlias(`ar-${Date.now()}`),
      authorId: String(body.authorId),
      text: String(body.text),
      createdAt: 'Just now',
      language: 'English',
      supportiveVotes: [],
    });
    saveStaticDb(db);
    return { post } as T;
  }

  const anonVoteMatch = pathname.match(/^\/api\/anonymous\/([^/]+)\/vote$/);
  if (anonVoteMatch && method === 'POST') {
    const post = db.anonymousPosts.find((a) => a.id === decodeURIComponent(anonVoteMatch[1]));
    if (!post) throw new Error('Anonymous thread not found.');
    const uid = String(body.userId);
    if (post.supportiveVotes.includes(uid)) {
      post.supportiveVotes = post.supportiveVotes.filter((id) => id !== uid);
    } else {
      post.supportiveVotes.push(uid);
    }
    saveStaticDb(db);
    return { post } as T;
  }

  const anonReportMatch = pathname.match(/^\/api\/anonymous\/([^/]+)\/report$/);
  if (anonReportMatch && method === 'POST') {
    const post = db.anonymousPosts.find((a) => a.id === decodeURIComponent(anonReportMatch[1]));
    if (!post) throw new Error('Anonymous thread not found.');
    post.reports.push({
      id: `rep-${Date.now()}`,
      reporterId: String(body.reporterId),
      reason: String(body.reason),
      createdAt: 'Just now',
    });
    saveStaticDb(db);
    return { post } as T;
  }

  if (pathname === '/api/notifications/read' && method === 'POST') {
    for (const n of db.notifications) {
      if (n.recipientId === body.userId) n.read = true;
    }
    saveStaticDb(db);
    return { ok: true } as T;
  }

  throw new Error(`Unsupported route in static mode: ${pathname}`);
}
