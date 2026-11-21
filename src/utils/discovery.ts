import {
  AlbumItem,
  AnonymousTopic,
  DiscoveryCategory,
  GroupItem,
  LocationScope,
  PhotoItem,
  PrivacyLevel,
  SocialPost,
  SphereIdCategory,
  UserProfile,
} from '../types/social';

export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  'Technology',
  'Gaming',
  'Art',
  'Music',
  'Travel',
  'Business',
  'Education',
  'Sports',
  'Lifestyle',
];

export const ANONYMOUS_TOPICS: AnonymousTopic[] = [
  'Personal Experiences',
  'Community Concerns',
  'Advice & Mentorship',
  'Ideas & Creativity',
  'General Discussions',
];

export const LOCATION_SCOPE_OPTIONS: {
  id: LocationScope;
  label: string;
  description: string;
}[] = [
  {
    id: 'nearby',
    label: 'Nearby',
    description: 'Updates from your town and neighboring communities',
  },
  {
    id: 'city',
    label: 'Municipality / City',
    description: 'Updates within your city or municipality',
  },
  {
    id: 'country',
    label: 'Country',
    description: 'Updates from across your country',
  },
  {
    id: 'global',
    label: 'Global',
    description: 'Updates from Sphere. members worldwide',
  },
];

export interface GlobalPrivacyFramework {
  country: string;
  lawName: string;
  shortCode: string;
  summary: string;
}

export const GLOBAL_PRIVACY_FRAMEWORKS: GlobalPrivacyFramework[] = [
  {
    country: 'Philippines',
    lawName: 'Data Privacy Act of 2012 (Republic Act No. 10173)',
    shortCode: 'RA 10173',
    summary: 'Right to be informed, access, object, rectify, and restrict visibility of personal data.',
  },
  {
    country: 'European Union / EEA',
    lawName: 'General Data Protection Regulation (GDPR)',
    shortCode: 'GDPR',
    summary: 'Lawful consent, data minimization, right of erasure, and strict audience transparency.',
  },
  {
    country: 'United Kingdom',
    lawName: 'UK GDPR & Data Protection Act 2018',
    shortCode: 'UK GDPR',
    summary: 'Explicit consent controls and granular personal profile protection.',
  },
  {
    country: 'United States',
    lawName: 'CCPA / CPRA & Applicable State Privacy Acts',
    shortCode: 'CCPA / CPRA',
    summary: 'Right to limit sharing, opt out of targeted profiling, and delete personal records.',
  },
  {
    country: 'Canada',
    lawName: 'Personal Information Protection and Electronic Documents Act',
    shortCode: 'PIPEDA',
    summary: 'Meaningful consent and purpose-limited visibility across social interactions.',
  },
  {
    country: 'Brazil',
    lawName: 'Lei Geral de Proteção de Dados',
    shortCode: 'LGPD',
    summary: 'Transparent data purpose, consent revocation, and user-controlled sharing.',
  },
  {
    country: 'Japan',
    lawName: 'Act on the Protection of Personal Information',
    shortCode: 'APPI',
    summary: 'Strict third-party sharing limits and purpose-of-use disclosure.',
  },
  {
    country: 'South Korea',
    lawName: 'Personal Information Protection Act',
    shortCode: 'PIPA',
    summary: 'Opt-in consent, strict minimization, and right to suspend processing.',
  },
  {
    country: 'Singapore',
    lawName: 'Personal Data Protection Act',
    shortCode: 'PDPA',
    summary: 'Consent, purpose limitation, and personal access/correction rights.',
  },
  {
    country: 'India',
    lawName: 'Digital Personal Data Protection Act',
    shortCode: 'DPDPA',
    summary: 'Clear notice, verifiable consent, and right to correction and erasure.',
  },
  {
    country: 'Australia',
    lawName: 'Privacy Act 1988 & Australian Privacy Principles',
    shortCode: 'APPs',
    summary: 'Transparent collection, open privacy management, and access rights.',
  },
  {
    country: 'Germany',
    lawName: 'EU GDPR & Bundesdatenschutzgesetz',
    shortCode: 'GDPR / BDSG',
    summary: 'Strict data minimization and explicit visibility consent.',
  },
  {
    country: 'Spain',
    lawName: 'EU GDPR & LOPDGDD',
    shortCode: 'GDPR / LOPDGDD',
    summary: 'Digital rights guarantee and strict personal audience controls.',
  },
  {
    country: 'South Africa',
    lawName: 'Protection of Personal Information Act',
    shortCode: 'POPIA',
    summary: 'Lawful processing, minimal collection, and data subject participation.',
  },
  {
    country: 'Nigeria',
    lawName: 'Nigeria Data Protection Act',
    shortCode: 'NDPA',
    summary: 'Explicit consent, accuracy, and protection against unauthorized exposure.',
  },
  {
    country: 'Mexico',
    lawName: 'Ley Federal de Protección de Datos Personales',
    shortCode: 'LFPDPPP',
    summary: 'ARCO rights (Access, Rectification, Cancellation, Opposition).',
  },
  {
    country: 'Colombia',
    lawName: 'Statutory Law 1581 of 2012',
    shortCode: 'Law 1581',
    summary: 'Prior authorization and full control over personal profile visibility.',
  },
];

export function getPrivacyFrameworkForCountry(country?: string): GlobalPrivacyFramework {
  const c = (country || '').trim().toLowerCase();
  const match = GLOBAL_PRIVACY_FRAMEWORKS.find(
    (f) => c && (f.country.toLowerCase() === c || f.country.toLowerCase().includes(c) || c.includes(f.country.toLowerCase()))
  );
  if (match) return match;
  return {
    country: country || 'Global Standard',
    lawName: 'Global Data Privacy Principles (GDPR / APPI / CCPA / RA 10173 Aligned)',
    shortCode: 'Global Privacy',
    summary:
      'Wherever you join from, Sphere. honors applicable regional data privacy laws with explicit consent, audience locks, and user-controlled visibility.',
  };
}

export interface PolicyGuidelineSection {
  number: number;
  title: string;
  intro: string;
  bullets?: string[];
  closing?: string;
}

export const SPHERE_COMMUNITY_GUIDELINES: {
  title: string;
  subtitle: string;
  preamble: string[];
  sections: PolicyGuidelineSection[];
  footerNote: string;
} = {
  title: 'Sphere Community Guidelines',
  subtitle: 'Building a space where everyone belongs.',
  preamble: [
    'Sphere is a place to connect, share ideas, express yourself, and build meaningful relationships. We want everyone to feel welcome, respected, and safe while being part of our community.',
    "To keep Sphere a positive environment, every member is expected to follow these guidelines. They are not here to limit genuine expression, but to make sure that everyone's experience is treated with care and respect.",
  ],
  sections: [
    {
      number: 1,
      title: 'Respect Others and Keep It Safe',
      intro: 'Treat people the way you would want to be treated. Different opinions are welcome, but disrespect and harmful behavior are not. Please avoid:',
      bullets: [
        'Hate speech, discrimination, or attacks based on someone’s identity or beliefs.',
        'Bullying, threats, harassment, or repeated unwanted contact.',
        'Content that promotes violence or encourages people to hurt themselves or others.',
        'Explicit sexual content, pornography, sexual exploitation, or any form of child abuse.',
        'Sharing private or sensitive information about someone without their permission.',
      ],
      closing: 'A simple reminder: You can disagree with someone without making them feel unsafe or unwelcome.',
    },
    {
      number: 2,
      title: 'Be Genuine. Be Yourself.',
      intro: 'Sphere values real people and honest interactions. We encourage members to use their accounts responsibly and represent themselves truthfully. The following are not allowed:',
      bullets: [
        'Creating accounts to impersonate another person, organization, or public figure.',
        'Using fake identities to deceive, manipulate, or mislead others.',
        'Sending repetitive, unwanted messages or posting spam.',
        'Buying, selling, or manipulating reactions, followers, reviews, or other forms of engagement.',
        'Using fake accounts to influence discussions or misrepresent popularity.',
      ],
      closing: 'Remember: Real connections matter more than numbers. Members must be 18+ years old; parents and guardians are advised to supervise minors.',
    },
    {
      number: 3,
      title: 'Handle Restricted Products and Services Responsibly',
      intro: 'Sphere does not allow the use of its platform to facilitate illegal, harmful, or unauthorized transactions. This includes:',
      bullets: [
        'Illegal drugs and controlled substances.',
        'Unauthorized firearm and weapon transactions.',
        'Alcohol sales or other restricted goods where prohibited.',
        'Illegal trade or unauthorized sale of live animals.',
        'Fraudulent services, deceptive offers, and scams.',
        'Gambling activities and regulated medical services without the necessary authorization.',
      ],
      closing: "Some products and services may be subject to additional restrictions under applicable laws and Sphere's approval requirements. Our goal: Protect members from unsafe transactions and misleading offers.",
    },
    {
      number: 4,
      title: "Give Credit Where It's Due",
      intro: 'Your creativity deserves respect, and so does everyone else’s. When sharing photos, videos, music, artwork, or other creative work, make sure you own it or have permission to use it. Please do not:',
      bullets: [
        "Repost someone else's work without permission when permission is required.",
        'Claim another person’s creative work as your own.',
        'Use copyrighted music, images, videos, or materials without the necessary rights.',
        "Misuse Sphere's name, branding, logos, or other protected materials.",
      ],
      closing: 'Giving credit is appreciated, but credit alone does not replace permission when permission is required. Create, share, and inspire, but respect the work behind every creation.',
    },
    {
      number: 5,
      title: 'Keep Pages, Circles, and Events Trustworthy',
      intro: 'Pages, Circles, and events help bring people together. Those who manage them are responsible for maintaining a safe, honest, and respectful environment. Administrators and organizers should:',
      bullets: [
        'Provide accurate information about their Pages, Circles, and events.',
        'Avoid misleading verification claims or false affiliations (only government-registered organizations may host Aid Drives).',
        'Keep discussions relevant and free from spam.',
        'Avoid deceptive invitations, fake promotions, and unauthorized commercial activities.',
        'Take reasonable action when members repeatedly violate community guidelines.',
      ],
      closing: "Having an administrative role does not exempt anyone from following Sphere's rules.",
    },
    {
      number: 6,
      title: 'What Happens When Rules Are Broken?',
      intro: 'We understand that mistakes happen. However, repeated or serious violations can affect the safety and experience of the entire community. Depending on the situation, Sphere may take one or more of the following actions:',
      bullets: [
        'Content Removal: Posts, comments, images, or other material may be removed.',
        'Visibility Restrictions: Content may receive reduced distribution or limited visibility.',
        'Temporary Restrictions: Certain activities, such as posting, messaging, or interacting with others, may be temporarily limited.',
        'Account Suspension: Accounts may be temporarily suspended following serious or repeated violations.',
        'Permanent Removal: Accounts may be disabled when violations are severe or continued despite previous action.',
      ],
      closing: "Enforcement decisions may consider the seriousness of the violation, its impact on others, and the member's previous behavior.",
    },
    {
      number: 7,
      title: 'Our Commitment to the Community',
      intro: 'Sphere is built by the people who use it. Every post, conversation, and interaction contributes to the kind of community we become. We encourage everyone to:',
      bullets: [
        'Be respectful, even when opinions differ.',
        'Think before sharing.',
        'Protect their own privacy and respect the privacy of others.',
        'Report content or behavior that puts the community at risk.',
        'Help make Sphere a welcoming place for everyone.',
      ],
      closing: "Let's make Sphere a place where people can connect freely, express themselves confidently, and feel good about being part of something bigger.",
    },
  ],
  footerNote: 'By using Sphere., you agree to follow these Community Guidelines and any additional platform policies that may apply.',
};

const BLOCKED_EXPLICIT_TERMS = [
  'pornography',
  'porn',
  'xxx',
  'nsfw',
  'nude',
  'nudity',
  'onlyfans',
  'hentai',
  'erotica',
  'sex tape',
  'explicit sexual',
  'hardcore sex',
  'escort service',
];

const BLOCKED_RESTRICTED_COMMERCE_TERMS = [
  'illegal drugs',
  'methamphetamine',
  'shabu',
  'cocaine',
  'heroin',
  'firearm for sale',
  'unlicensed gun',
  'illegal weapon',
  'ammunition for sale',
  'online gambling',
  'illegal betting',
];

export function checkSafeContent(text: string): { ok: boolean; reason?: string } {
  const lower = (text || '').toLowerCase();
  for (const term of BLOCKED_EXPLICIT_TERMS) {
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) {
      return {
        ok: false,
        reason:
          'This violates Section 1 of the Sphere Community Guidelines (explicit sexual content or pornography is not allowed). Open Sphere Policy Guidelines for details.',
      };
    }
  }
  for (const term of BLOCKED_RESTRICTED_COMMERCE_TERMS) {
    if (lower.includes(term)) {
      return {
        ok: false,
        reason:
          'This violates Section 3 of the Sphere Community Guidelines (restricted goods or unauthorized transactions). Open Sphere Policy Guidelines for details.',
      };
    }
  }
  return { ok: true };
}

export function extractCityAndCountry(user: Pick<UserProfile, 'location' | 'country'>): {
  city: string;
  province: string;
  country: string;
} {
  const parts = (user.location || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const city = parts[0] || '';
  const country = user.country || (parts.length >= 2 ? parts[parts.length - 1] : 'Philippines');
  const province = parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[1] : '';
  return { city, province, country };
}

const NEARBY_CLUSTER_TERMS: Record<string, string[]> = {
  labo: ['labo', 'daet', 'camarines norte', 'bagasbas', 'vinzons', 'talisay', 'bicol'],
  daet: ['daet', 'labo', 'camarines norte', 'bagasbas', 'mercedes', 'bicol'],
  manila: ['manila', 'quezon city', 'makati', 'pasig', 'bgc', 'metro manila'],
  tokyo: ['tokyo', 'shibuya', 'shinjuku', 'yokohama'],
  seoul: ['seoul', 'seongsu', 'hongdae', 'gangnam'],
  berlin: ['berlin', 'potsdam'],
  madrid: ['madrid'],
  dakar: ['dakar'],
};

export function matchesLocationScope(
  post: SocialPost,
  author: UserProfile | undefined,
  currentUser: UserProfile,
  scope: LocationScope
): boolean {
  if (scope === 'global' || currentUser.locationDiscoveryEnabled === false) {
    return true;
  }
  const userGeo = extractCityAndCountry(currentUser);
  const postLocationRaw = (post.location || author?.location || '').toLowerCase();
  const postCountryRaw = (post.country || author?.country || '').toLowerCase();

  if (scope === 'country') {
    const userCountry = userGeo.country.toLowerCase();
    if (!userCountry) return true;
    return (
      postCountryRaw.includes(userCountry) ||
      postLocationRaw.includes(userCountry) ||
      (userCountry === 'philippines' &&
        (postLocationRaw.includes('labo') ||
          postLocationRaw.includes('daet') ||
          postLocationRaw.includes('manila') ||
          postLocationRaw.includes('camarines norte')))
    );
  }

  if (scope === 'city') {
    const cityKey = userGeo.city.toLowerCase();
    if (!cityKey) return true;
    return postLocationRaw.includes(cityKey);
  }

  const cityKey = userGeo.city.toLowerCase();
  const cluster =
    NEARBY_CLUSTER_TERMS[cityKey] || [cityKey, userGeo.province.toLowerCase()].filter(Boolean);
  return cluster.some((term) => term && postLocationRaw.includes(term));
}

export interface InterestMatchResult {
  score: number;
  sharedInterests: string[];
  sharedHobbies: string[];
  sharedSkills: string[];
  sharedGoals: string[];
  sharedCategories: DiscoveryCategory[];
  allShared: string[];
}

function intersectNormalized(a: string[] = [], b: string[] = []): string[] {
  const bSet = new Set(b.map((item) => item.trim().toLowerCase()));
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const item of a) {
    const norm = item.trim().toLowerCase();
    if (norm && bSet.has(norm) && !seen.has(norm)) {
      seen.add(norm);
      matches.push(item.trim());
    }
  }
  return matches;
}

export function computeInterestMatch(viewer: UserProfile, candidate: UserProfile): InterestMatchResult {
  const sharedInterests = intersectNormalized(viewer.interests, candidate.interests);
  const sharedHobbies = intersectNormalized(
    viewer.hobbies || viewer.interests,
    candidate.hobbies || candidate.interests
  );
  const sharedSkills = intersectNormalized(viewer.skills || [], candidate.skills || []);
  const sharedGoals = intersectNormalized(viewer.goals || [], candidate.goals || []);
  const viewerCats = viewer.categories || [];
  const candCats = candidate.categories || [];
  const sharedCategories = viewerCats.filter((c) => candCats.includes(c));

  const seenAll = new Set<string>();
  const allShared: string[] = [];
  for (const item of [...sharedInterests, ...sharedHobbies, ...sharedSkills, ...sharedCategories]) {
    const key = item.toLowerCase();
    if (!seenAll.has(key)) {
      seenAll.add(key);
      allShared.push(item);
    }
  }

  const score =
    sharedInterests.length * 3 +
    sharedHobbies.length * 2 +
    sharedSkills.length * 3 +
    sharedGoals.length * 4 +
    sharedCategories.length * 2;

  return {
    score,
    sharedInterests,
    sharedHobbies,
    sharedSkills,
    sharedGoals,
    sharedCategories,
    allShared,
  };
}

export function getEffectiveSphereId(
  user?: Pick<UserProfile, 'sphereIdCategory' | 'verified'>
): SphereIdCategory {
  if (!user) return 'unverified';
  if (user.sphereIdCategory) return user.sphereIdCategory;
  return user.verified ? 'verified_individual' : 'unverified';
}

export function getSphereIdLabel(category: SphereIdCategory): string {
  switch (category) {
    case 'verified_individual':
      return 'Verified Individual';
    case 'verified_organization':
      return 'Verified Organization';
    default:
      return 'Unverified Account';
  }
}

const ALIAS_ADJECTIVES = [
  'Quiet',
  'Cobalt',
  'Harbor',
  'North',
  'Amber',
  'Cedar',
  'Misty',
  'Lunar',
  'Silver',
  'Breeze',
];

const ALIAS_NOUNS = [
  'Wave',
  'Lantern',
  'Horizon',
  'Compass',
  'Echo',
  'Pine',
  'Sketch',
  'River',
  'Cloud',
  'Signal',
];

export function generateAnonymousAlias(seedInput: string): string {
  let hash = 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    hash = (hash * 31 + seedInput.charCodeAt(i)) >>> 0;
  }
  const adj = ALIAS_ADJECTIVES[hash % ALIAS_ADJECTIVES.length];
  const noun = ALIAS_NOUNS[Math.floor(hash / 7) % ALIAS_NOUNS.length];
  const num = 100 + (hash % 899);
  return `${adj}${noun}-${num}`;
}

export async function hashFileMetadata(file: File): Promise<string> {
  try {
    const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `${file.size.toString(16)}${Date.now().toString(16).slice(-6)}`;
  }
}

// =========================================================================
// PRIVACY & RELATIONSHIP ENFORCEMENT (SHARED BETWEEN CLIENT & SERVER)
// =========================================================================

export function areFriends(a: UserProfile | undefined, b: UserProfile | undefined, friendships?: Record<string, Set<string>>): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  if (friendships) {
    return Boolean(friendships[a.id]?.has(b.id));
  }
  return b.friendship === 'friends';
}

export function isFriendOfFriend(
  viewerId: string,
  targetId: string,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>
): boolean {
  if (viewerId === targetId) return true;
  if (friendships) {
    const viewerSet = friendships[viewerId];
    const targetSet = friendships[targetId];
    if (!viewerSet || !targetSet) return false;
    if (viewerSet.has(targetId)) return true;
    for (const fid of viewerSet) {
      if (targetSet.has(fid)) return true;
    }
    return false;
  }
  const target = users.find((u) => u.id === targetId);
  if (!target) return false;
  if (target.friendship === 'friends') return true;
  return target.mutualFriends > 0;
}

export const PRIVACY_STRICTNESS: Record<PrivacyLevel, number> = {
  public: 0,
  friends_of_friends: 1,
  friends_only: 2,
  only_me: 3,
};

export function clampSharedPrivacy(
  originalPrivacy: PrivacyLevel | undefined,
  requestedPrivacy: PrivacyLevel | undefined
): PrivacyLevel {
  const orig = originalPrivacy || 'public';
  const req = requestedPrivacy || orig;
  return PRIVACY_STRICTNESS[req] >= PRIVACY_STRICTNESS[orig] ? req : orig;
}

export function isBlockedBetween(
  userA: string | undefined,
  userB: string | undefined,
  blockedUsers?: Record<string, string[]>,
  users?: UserProfile[]
): boolean {
  if (!userA || !userB || userA === userB) return false;
  if (blockedUsers) {
    if ((blockedUsers[userA] || []).includes(userB)) return true;
    if ((blockedUsers[userB] || []).includes(userA)) return true;
  }
  if (users) {
    const aProfile = users.find((u) => u.id === userA);
    const bProfile = users.find((u) => u.id === userB);
    if (aProfile?.blockedUserIds?.includes(userB)) return true;
    if (bProfile?.blockedUserIds?.includes(userA)) return true;
  }
  return false;
}

export function canSatisfyPrivacy(
  level: 'public' | 'friends_of_friends' | 'friends_only' | 'only_me' | undefined,
  viewerId: string,
  ownerId: string,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>,
  blockedUsers?: Record<string, string[]>
): boolean {
  const effective = level || 'public';
  if (viewerId === ownerId) return true;
  if (isBlockedBetween(viewerId, ownerId, blockedUsers, users)) return false;
  if (effective === 'public') return true;
  if (effective === 'only_me') return false;
  const viewer = users.find((u) => u.id === viewerId);
  const owner = users.find((u) => u.id === ownerId);
  if (effective === 'friends_only') {
    return areFriends(viewer, owner, friendships);
  }
  // friends_of_friends
  return isFriendOfFriend(viewerId, ownerId, users, friendships);
}

export function canViewProfile(
  viewerId: string,
  target: UserProfile,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>,
  blockedUsers?: Record<string, string[]>
): boolean {
  return canSatisfyPrivacy(target.privacy, viewerId, target.id, users, friendships, blockedUsers);
}

export function canViewPost(
  viewerId: string,
  post: SocialPost,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>,
  groups?: GroupItem[],
  blockedUsers?: Record<string, string[]>
): boolean {
  if (post.authorId === viewerId) return true;
  if (isBlockedBetween(viewerId, post.authorId, blockedUsers, users)) return false;
  if (post.targetProfileId && isBlockedBetween(viewerId, post.targetProfileId, blockedUsers, users)) {
    return false;
  }
  if (post.targetProfileId && post.wallApproved === false) {
    return post.targetProfileId === viewerId || post.authorId === viewerId;
  }
  if (post.groupId && groups) {
    const grp = groups.find((g) => g.id === post.groupId);
    if (grp && grp.privacy === 'private' && !grp.memberIds.includes(viewerId)) {
      return false;
    }
  }
  if (post.postAsPage) {
    return canSatisfyPrivacy(post.privacy || 'public', viewerId, post.authorId, users, friendships, blockedUsers);
  }
  const author = users.find((u) => u.id === post.authorId);
  const postPrivacy = post.privacy || author?.privacy || 'public';
  // Account-level privacy also caps non-friend visibility unless public
  if (author && author.privacy === 'only_me' && viewerId !== author.id) return false;
  if (
    author &&
    author.privacy === 'friends_only' &&
    !canSatisfyPrivacy('friends_only', viewerId, author.id, users, friendships, blockedUsers)
  ) {
    return false;
  }
  return canSatisfyPrivacy(postPrivacy, viewerId, post.authorId, users, friendships, blockedUsers);
}

export function canPostInGroup(
  userId: string,
  group: GroupItem,
  userRole?: UserProfile['role']
): { allowed: boolean; reason?: string } {
  if (!group.memberIds.includes(userId)) {
    return {
      allowed: false,
      reason:
        group.privacy === 'private'
          ? 'You must be an active member of this private Circle to post here.'
          : 'Join this Circle first to publish or share posts inside it.',
    };
  }
  const policyText = (group.postingPolicy || '').toLowerCase();
  const isModOnly =
    Boolean(group.moderatorOnlyPosting) ||
    /\b(admins?\s+only|moderators?\s+only|only\s+(admins?|moderators?)\s+(can|may)\s+post)\b/i.test(
      policyText
    );
  if (isModOnly && group.creatorId !== userId && userRole !== 'admin') {
    return {
      allowed: false,
      reason: 'Posting in this Circle is currently restricted to Circle moderators.',
    };
  }
  return { allowed: true };
}

export interface PostSharePolicy {
  canViewOriginal: boolean;
  canShare: boolean;
  shareBlockedReason?: string;
  canShareToFriendsMessage: boolean;
  canShareToTimeline: boolean;
  canShareToGroups: boolean;
  groupsBlockedReason?: string;
  canShareExternally: boolean;
  externalBlockedReason?: string;
  canCopyLink: boolean;
  copyLinkBlockedReason?: string;
  maxAllowedPrivacy: PrivacyLevel;
  effectiveOriginalPrivacy: PrivacyLevel;
  isPrivateGroupPost: boolean;
}

export function getPostSharePolicy(
  viewerId: string,
  post: SocialPost,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>,
  groups?: GroupItem[],
  blockedUsers?: Record<string, string[]>
): PostSharePolicy {
  const author = users.find((u) => u.id === post.authorId);
  const group = post.groupId && groups ? groups.find((g) => g.id === post.groupId) : undefined;
  const isPrivateGroupPost = Boolean(group && group.privacy === 'private');
  const postPrivacy: PrivacyLevel = post.privacy || 'public';
  const accountPrivacy: PrivacyLevel = author?.privacy || 'public';
  const effectiveOriginalPrivacy: PrivacyLevel = isPrivateGroupPost
    ? 'friends_only'
    : PRIVACY_STRICTNESS[accountPrivacy] > PRIVACY_STRICTNESS[postPrivacy] && !post.postAsPage
      ? accountPrivacy
      : postPrivacy;

  const canViewOriginal = viewerId
    ? canViewPost(viewerId, post, users, friendships, groups, blockedUsers)
    : effectiveOriginalPrivacy === 'public' && !isPrivateGroupPost;

  if (!canViewOriginal) {
    return {
      canViewOriginal: false,
      canShare: false,
      shareBlockedReason: 'You do not have permission to view or share this post.',
      canShareToFriendsMessage: false,
      canShareToTimeline: false,
      canShareToGroups: false,
      canShareExternally: false,
      externalBlockedReason: 'Private or restricted posts cannot be shared externally.',
      canCopyLink: false,
      copyLinkBlockedReason: 'You do not have permission to copy a link to this post.',
      maxAllowedPrivacy: 'only_me',
      effectiveOriginalPrivacy,
      isPrivateGroupPost,
    };
  }

  if (effectiveOriginalPrivacy === 'only_me') {
    return {
      canViewOriginal: true,
      canShare: false,
      shareBlockedReason:
        'Private ("Only Me") posts cannot be reshared, forwarded, or exposed via share links.',
      canShareToFriendsMessage: false,
      canShareToTimeline: false,
      canShareToGroups: false,
      groupsBlockedReason: 'Private ("Only Me") posts cannot be shared to Circles.',
      canShareExternally: false,
      externalBlockedReason: 'Private ("Only Me") posts cannot be shared outside Sphere.',
      canCopyLink: false,
      copyLinkBlockedReason: 'Link sharing is disabled for "Only Me" private posts.',
      maxAllowedPrivacy: 'only_me',
      effectiveOriginalPrivacy,
      isPrivateGroupPost,
    };
  }

  const isPublicShareable = effectiveOriginalPrivacy === 'public' && !isPrivateGroupPost;

  return {
    canViewOriginal: true,
    canShare: true,
    canShareToFriendsMessage: true,
    canShareToTimeline: !isPrivateGroupPost,
    canShareToGroups: true,
    groupsBlockedReason: isPrivateGroupPost
      ? 'Posts from a private Circle can only remain within private Circle members.'
      : undefined,
    canShareExternally: isPublicShareable,
    externalBlockedReason: isPublicShareable
      ? undefined
      : isPrivateGroupPost
        ? 'Private Circle posts cannot be shared outside Sphere.'
        : 'Only Public posts can be shared outside Sphere to protect the author’s audience restrictions.',
    canCopyLink: !isPrivateGroupPost,
    copyLinkBlockedReason: isPrivateGroupPost
      ? 'Private Circle posts cannot be exposed via external links.'
      : undefined,
    maxAllowedPrivacy: effectiveOriginalPrivacy,
    effectiveOriginalPrivacy,
    isPrivateGroupPost,
  };
}

export function canViewPhoto(
  viewerId: string,
  photo: PhotoItem,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>
): boolean {
  if (photo.ownerId === viewerId) return true;
  if (photo.postAsPage) return canSatisfyPrivacy(photo.privacy || 'public', viewerId, photo.ownerId, users, friendships);
  const owner = users.find((u) => u.id === photo.ownerId);
  if (owner && owner.privacy === 'only_me' && viewerId !== owner.id) return false;
  if (owner && owner.privacy === 'friends_only' && !canSatisfyPrivacy('friends_only', viewerId, owner.id, users, friendships)) {
    return false;
  }
  return canSatisfyPrivacy(photo.privacy || 'public', viewerId, photo.ownerId, users, friendships);
}

export function canViewAlbum(
  viewerId: string,
  album: AlbumItem,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>
): boolean {
  if (album.ownerId === viewerId) return true;
  return canSatisfyPrivacy(album.privacy, viewerId, album.ownerId, users, friendships);
}

export function canTagUser(
  actorId: string,
  target: UserProfile,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>
): { allowed: boolean; requiresApproval: boolean; reason?: string } {
  if (actorId === target.id) return { allowed: true, requiresApproval: false };
  const settings = target.taggingSettings || {
    enabled: true,
    whoCanTag: 'friends',
    requireApproval: true,
  };
  if (!settings.enabled || settings.whoCanTag === 'no_one') {
    return { allowed: false, requiresApproval: false, reason: `${target.name} has disabled profile tagging.` };
  }
  if (settings.whoCanTag === 'friends') {
    const actor = users.find((u) => u.id === actorId);
    if (!areFriends(actor, target, friendships)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Only friends can tag ${target.name}.`,
      };
    }
  }
  return { allowed: true, requiresApproval: settings.requireApproval };
}

export function canPostOnWall(
  actorId: string,
  target: UserProfile,
  users: UserProfile[],
  friendships?: Record<string, Set<string>>
): { allowed: boolean; requiresApproval: boolean; reason?: string } {
  if (actorId === target.id) return { allowed: true, requiresApproval: false };
  const settings = target.wallSharingSettings || {
    enabled: true,
    whoCanPost: 'friends',
    requireApproval: true,
  };
  if (!settings.enabled || settings.whoCanPost === 'no_one') {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `${target.name} has disabled posting to their MySpace wall.`,
    };
  }
  if (settings.whoCanPost === 'friends') {
    const actor = users.find((u) => u.id === actorId);
    if (!areFriends(actor, target, friendships)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Only friends can share posts to ${target.name}'s MySpace wall.`,
      };
    }
  }
  return { allowed: true, requiresApproval: settings.requireApproval };
}

export interface BirthdaySuggestion {
  user: UserProfile;
  isToday: boolean;
  daysAway: number;
  label: string;
}

export function getBirthdaySuggestions(
  currentUser: UserProfile,
  users: UserProfile[],
  referenceDate: Date = new Date()
): BirthdaySuggestion[] {
  const todayMonth = referenceDate.getMonth() + 1;
  const todayDay = referenceDate.getDate();
  const currentYear = referenceDate.getFullYear();

  const suggestions: BirthdaySuggestion[] = [];

  for (const person of users) {
    if (person.id === currentUser.id || person.friendship !== 'friends' || !person.birthday) {
      continue;
    }
    const parts = person.birthday.split('-');
    if (parts.length !== 3) continue;
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!month || !day) continue;

    let nextBday = new Date(currentYear, month - 1, day);
    const todayMidnight = new Date(currentYear, todayMonth - 1, todayDay);
    if (nextBday < todayMidnight) {
      nextBday = new Date(currentYear + 1, month - 1, day);
    }
    const diffDays = Math.round((nextBday.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 14) {
      suggestions.push({
        user: person,
        isToday: diffDays === 0,
        daysAway: diffDays,
        label:
          diffDays === 0
            ? 'Birthday today'
            : diffDays === 1
              ? 'Birthday tomorrow'
              : `Birthday in ${diffDays} days`,
      });
    }
  }

  return suggestions.sort((a, b) => a.daysAway - b.daysAway);
}
