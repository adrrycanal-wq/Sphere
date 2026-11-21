import {
  AdCampaign,
  AdObjective,
  AdStatus,
  AlbumItem,
  AnonymousPost,
  AnonymousTopic,
  AttachmentItem,
  BootstrapPayload,
  DiscoveryCategory,
  DonationDrive,
  GroupItem,
  LiveStreamComment,
  MarketplaceItem,
  MessageThread,
  PageItem,
  PhotoItem,
  PostComment,
  PostVibe,
  PrivacyLevel,
  ReactionType,
  SocialPost,
  SphereIdVerificationRequest,
  TestimonialItem,
  UserProfile,
  VideoFormat,
  ActiveSessionRecord,
  GovIdType,
  LoginActivityRecord,
  RecoveryRequestRecord,
  RecoveryStatus,
  SecurityAuditLogEntry,
  SecurityRole,
  SuspiciousActivityAlert,
  UserSecuritySummary,
} from '../types/social';
import {
  syncPostToFirestore,
  syncProfileToFirestore,
  syncRecoverySummaryToFirestore,
  syncUserSecuritySettingsToFirestore,
} from '../firebase';
import { DirectoryQueryResult } from './globalDirectory';

const SESSION_TOKEN_KEY = 'sphere_session_token';
let cachedCsrfToken: string | null = null;
let staticHostingMode = false;

export function isStaticHostingMode(): boolean {
  return staticHostingMode;
}

export function getSphereSessionToken(): string {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setSphereSessionToken(token?: string): void {
  try {
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function clearSphereSessionToken(): void {
  cachedCsrfToken = null;
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

async function callStaticFallback<T>(url: string, options?: RequestInit): Promise<T> {
  staticHostingMode = true;
  const { handleStaticApi } = await import('./staticApiFallback');
  return handleStaticApi<T>(url, options);
}

async function ensureCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const res = await fetch('/api/security/csrf');
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('application/json')) return '';
  const json = (await res.json()) as { csrfToken?: string };
  cachedCsrfToken = json.csrfToken || null;
  return cachedCsrfToken || '';
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  if (staticHostingMode) {
    return callStaticFallback<T>(url, options);
  }

  const method = String(options?.method || 'GET').toUpperCase();
  const needsCsrf =
    method !== 'GET' &&
    method !== 'HEAD' &&
    (url.startsWith('/api/security') || url.startsWith('/api/recovery'));

  const extraHeaders: Record<string, string> = {};
  const sessionToken = getSphereSessionToken();
  if (sessionToken) {
    extraHeaders['x-sphere-session'] = sessionToken;
  }
  if (needsCsrf) {
    const csrf = await ensureCsrfToken().catch(() => '');
    if (csrf) extraHeaders['x-csrf-token'] = csrf;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
        ...(options?.headers || {}),
      },
    });
  } catch {
    return callStaticFallback<T>(url, options);
  }

  // Retry once on CSRF expiration
  if (res.status === 403 && needsCsrf) {
    const probe = await res.clone().json().catch(() => ({}));
    if (String(probe?.error || '').toLowerCase().includes('csrf')) {
      cachedCsrfToken = null;
      const fresh = await ensureCsrfToken().catch(() => '');
      if (fresh) {
        res = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...extraHeaders,
            'x-csrf-token': fresh,
            ...(options?.headers || {}),
          },
        });
      }
    }
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Firebase Hosting SPA rewrite returns index.html (text/html) for /api/* routes
    return callStaticFallback<T>(url, options);
  }
  if (!res.ok && res.status === 405) {
    return callStaticFallback<T>(url, options);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      requiresAdminMfa?: boolean;
      existingReferenceNumber?: string;
    };
    err.status = res.status;
    err.requiresAdminMfa = Boolean(data?.requiresAdminMfa);
    err.existingReferenceNumber = data?.existingReferenceNumber;
    throw err;
  }
  return data as T;
}

export async function fetchBootstrap(viewerId?: string): Promise<BootstrapPayload> {
  const qs = viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : '';
  return apiJson<BootstrapPayload>(`/api/bootstrap${qs}`);
}

export async function apiLogin(
  identifier: string,
  password: string
): Promise<{ user: UserProfile; sessionToken?: string }> {
  const res = await apiJson<{ user: UserProfile; sessionToken?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  if (res.sessionToken) setSphereSessionToken(res.sessionToken);
  return res;
}

export async function apiRegister(payload: {
  firstName: string;
  lastName: string;
  handle: string;
  email: string;
  mobile: string;
  password: string;
  birthday: string;
  gender: string;
  location: string;
  country: string;
  language: string;
  preferredLanguage: string;
  privacyConsent: boolean;
  guidelinesConsent: boolean;
}): Promise<{ user: UserProfile; sessionToken?: string }> {
  const res = await apiJson<{ user: UserProfile; sessionToken?: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.sessionToken) setSphereSessionToken(res.sessionToken);
  return res;
}

export async function apiResetPassword(identifier: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiJson('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ identifier, newPassword }),
  });
}

export async function apiSendEmailOtp(email: string): Promise<{
  sent: boolean;
  smtpConfigured: boolean;
  message?: string;
}> {
  return apiJson('/api/auth/email-otp/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiVerifyEmailOtp(email: string, code: string): Promise<{ verified: boolean }> {
  return apiJson('/api/auth/email-otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export interface FirebaseSessionPayload {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
  emailVerified?: boolean;
  otpVerified?: boolean;
  signupDetails?: {
    firstName: string;
    lastName: string;
    handle: string;
    birthday: string;
    gender: string;
    location: string;
    country: string;
    language: string;
    preferredLanguage: string;
    email?: string;
    mobile?: string;
    interests?: string[];
    privacyConsent: boolean;
    guidelinesConsent: boolean;
  };
}

export async function apiSyncFirebaseSession(payload: FirebaseSessionPayload): Promise<{
  user?: UserProfile;
  sessionToken?: string;
  needsOnboarding?: boolean;
  uid?: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
}> {
  const res = await apiJson<{
    user?: UserProfile;
    sessionToken?: string;
    needsOnboarding?: boolean;
    uid?: string;
    email?: string;
    phoneNumber?: string;
    displayName?: string;
  }>('/api/auth/firebase-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.sessionToken) setSphereSessionToken(res.sessionToken);
  if (res.user) {
    await syncProfileToFirestore(res.user).catch((err) => {
      console.warn('Firestore profile mirror warning:', err);
    });
  }
  return res;
}


export async function fetchGlobalDirectory(params: {
  viewerId?: string;
  page?: number;
  limit?: number;
  q?: string;
  country?: string;
  category?: DiscoveryCategory | 'All';
}): Promise<DirectoryQueryResult> {
  const qs = new URLSearchParams();
  if (params.viewerId) qs.set('viewerId', params.viewerId);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.q) qs.set('q', params.q);
  if (params.country) qs.set('country', params.country);
  if (params.category) qs.set('category', params.category);
  return apiJson<DirectoryQueryResult>(`/api/directory?${qs.toString()}`);
}

export async function fetchGlobalUser(id: string, viewerId?: string): Promise<{ user: UserProfile }> {
  const qs = viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : '';
  return apiJson<{ user: UserProfile }>(`/api/directory/${encodeURIComponent(id)}${qs}`);
}

export async function apiFetchUserActivity(
  userId: string,
  viewerId?: string
): Promise<{
  user: UserProfile;
  posts: SocialPost[];
  photos: PhotoItem[];
  albums: AlbumItem[];
  testimonials: TestimonialItem[];
}> {
  const qs = viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : '';
  return apiJson(`/api/users/${encodeURIComponent(userId)}/activity${qs}`);
}

export async function apiUpdateUser(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ user: UserProfile }> {
  const res = await apiJson<{ user: UserProfile }>(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (res.user) {
    await syncProfileToFirestore(res.user).catch((err) => {
      console.warn('Firestore profile mirror warning:', err);
    });
  }
  return res;
}

export async function apiToggleFriend(
  targetUserId: string,
  viewerId: string,
  action?: 'toggle' | 'accept' | 'decline'
): Promise<{ ok: boolean; friendship: UserProfile['friendship'] }> {
  return apiJson(`/api/users/${encodeURIComponent(targetUserId)}/friend`, {
    method: 'POST',
    body: JSON.stringify({ viewerId, action }),
  });
}

export async function apiUploadFile(payload: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
}): Promise<{ url: string; mimeType: string; sizeBytes: number; name: string }> {
  return apiJson('/api/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiCreatePost(payload: {
  authorId: string;
  content: string;
  location?: string;
  country?: string;
  privacy?: PrivacyLevel;
  vibe?: PostVibe;
  targetProfileId?: string;
  taggedUserIds?: string[];
  groupId?: string;
  pageId?: string;
  postAsPage?: boolean;
  photoSrc?: string;
  photoCaption?: string;
  albumId?: string;
  video?: {
    src: string;
    format: VideoFormat;
    title?: string;
    durationLabel?: string;
    durationSeconds?: number;
  };
}): Promise<{ post: SocialPost; photo?: PhotoItem; message?: string }> {
  const res = await apiJson<{ post: SocialPost; photo?: PhotoItem; message?: string }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.post) {
    await syncPostToFirestore(res.post).catch((err) => {
      console.warn('Firestore post mirror warning:', err);
    });
  }
  return res;
}

export async function apiDeletePost(postId: string, userId: string): Promise<{ ok: boolean }> {
  return apiJson(`/api/posts/${encodeURIComponent(postId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function apiUpdatePostAudience(
  postId: string,
  userId: string,
  privacy: PrivacyLevel
): Promise<{ post: SocialPost }> {
  return apiJson(`/api/posts/${encodeURIComponent(postId)}/audience`, {
    method: 'PATCH',
    body: JSON.stringify({ userId, privacy }),
  });
}

export async function apiReactPost(
  postId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ post: SocialPost; switchesRemaining: number }> {
  return apiJson(`/api/posts/${encodeURIComponent(postId)}/react`, {
    method: 'POST',
    body: JSON.stringify({ userId, reactionType }),
  });
}

export async function apiAddPostComment(
  postId: string,
  authorId: string,
  text: string
): Promise<{ comment: PostComment; post: SocialPost }> {
  return apiJson(`/api/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ authorId, text }),
  });
}

export async function apiReactComment(
  postId: string,
  commentId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ post: SocialPost; switchesRemaining: number }> {
  return apiJson(
    `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/react`,
    {
      method: 'POST',
      body: JSON.stringify({ userId, reactionType }),
    }
  );
}

export async function apiSharePost(payload: {
  postId: string;
  authorId: string;
  commentary?: string;
  privacy: PrivacyLevel;
}): Promise<{ post: SocialPost }> {
  return apiJson(`/api/posts/${encodeURIComponent(payload.postId)}/share`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiDecideTag(
  postId: string,
  userId: string,
  decision: 'approve' | 'reject' | 'remove'
): Promise<{ post: SocialPost }> {
  const endpoint = decision === 'remove' ? 'remove-tag' : 'tag-decision';
  return apiJson(`/api/posts/${encodeURIComponent(postId)}/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({ userId, decision }),
  });
}

export async function apiDecideWallPost(
  postId: string,
  userId: string,
  decision: 'approve' | 'reject' | 'remove'
): Promise<{ ok: boolean; post?: SocialPost }> {
  return apiJson(`/api/posts/${encodeURIComponent(postId)}/wall-decision`, {
    method: 'POST',
    body: JSON.stringify({ userId, decision }),
  });
}

export async function apiCreateAlbum(payload: {
  ownerId: string;
  name: string;
  description: string;
  privacy: 'public' | 'friends_only' | 'only_me';
}): Promise<{ album: AlbumItem }> {
  return apiJson('/api/albums', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateAlbum(
  albumId: string,
  userId: string,
  updates: Partial<AlbumItem>
): Promise<{ album: AlbumItem }> {
  return apiJson(`/api/albums/${encodeURIComponent(albumId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ userId, ...updates }),
  });
}

export async function apiDeleteAlbum(
  albumId: string,
  userId: string,
  deleteMedia: boolean
): Promise<{ ok: boolean }> {
  return apiJson(
    `/api/albums/${encodeURIComponent(albumId)}?userId=${encodeURIComponent(userId)}&deleteMedia=${deleteMedia ? 'true' : 'false'}`,
    { method: 'DELETE' }
  );
}

export async function apiUploadPhotosToAlbum(payload: {
  ownerId: string;
  albumId?: string;
  privacy: PrivacyLevel;
  location: string;
  items: {
    src: string;
    caption: string;
    mediaType?: 'image' | 'video';
    videoFormat?: VideoFormat;
  }[];
}): Promise<{ photos: PhotoItem[] }> {
  return apiJson('/api/photos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdatePhoto(
  photoId: string,
  userId: string,
  updates: { caption?: string; albumId?: string; privacy?: PrivacyLevel }
): Promise<{ photo: PhotoItem }> {
  return apiJson(`/api/photos/${encodeURIComponent(photoId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ userId, ...updates }),
  });
}

export async function apiDeletePhoto(photoId: string, userId: string): Promise<{ ok: boolean }> {
  return apiJson(`/api/photos/${encodeURIComponent(photoId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function apiReactPhoto(
  photoId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ photo: PhotoItem; switchesRemaining: number }> {
  return apiJson(`/api/photos/${encodeURIComponent(photoId)}/react`, {
    method: 'POST',
    body: JSON.stringify({ userId, reactionType }),
  });
}

export async function apiCommentPhoto(
  photoId: string,
  authorId: string,
  text: string
): Promise<{ photo: PhotoItem }> {
  return apiJson(`/api/photos/${encodeURIComponent(photoId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ authorId, text }),
  });
}

export async function apiCreateMarketplaceItem(payload: {
  sellerId: string;
  title: string;
  price: number;
  category: string;
  condition: MarketplaceItem['condition'];
  location: string;
  description: string;
  imageSrc?: string;
  privacy: PrivacyLevel;
  allowCommentsAndReactions: boolean;
  crossPostToFeed?: boolean;
}): Promise<{ item: MarketplaceItem; post?: SocialPost }> {
  return apiJson('/api/marketplace', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiToggleMarketplaceSold(
  itemId: string,
  userId: string
): Promise<{ item: MarketplaceItem }> {
  return apiJson(`/api/marketplace/${encodeURIComponent(itemId)}/toggle-sold`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function apiReactMarketplaceItem(
  itemId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ item: MarketplaceItem; switchesRemaining: number }> {
  return apiJson(`/api/marketplace/${encodeURIComponent(itemId)}/react`, {
    method: 'POST',
    body: JSON.stringify({ userId, reactionType }),
  });
}

export async function apiCommentMarketplaceItem(
  itemId: string,
  authorId: string,
  text: string
): Promise<{ item: MarketplaceItem }> {
  return apiJson(`/api/marketplace/${encodeURIComponent(itemId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ authorId, text }),
  });
}

export async function apiCreatePage(payload: {
  ownerId: string;
  name: string;
  handle: string;
  category: string;
  location: string;
  description: string;
  rules?: string[];
  postingPolicy?: string;
  guidelinesSummary?: string;
}): Promise<{ page: PageItem }> {
  return apiJson('/api/pages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdatePageRules(
  pageId: string,
  payload: {
    userId: string;
    rules: string[];
    postingPolicy: string;
    guidelinesSummary?: string;
  }
): Promise<{ page: PageItem }> {
  return apiJson(`/api/pages/${encodeURIComponent(pageId)}/rules`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function apiTogglePageFollow(pageId: string, userId: string): Promise<{ page: PageItem }> {
  return apiJson(`/api/pages/${encodeURIComponent(pageId)}/follow`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function apiCreateGroup(payload: {
  creatorId: string;
  name: string;
  category: string;
  location: string;
  description: string;
  privacy: 'public' | 'private';
  rules?: string[];
  postingPolicy?: string;
  guidelinesSummary?: string;
}): Promise<{ group: GroupItem }> {
  return apiJson('/api/groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateGroupRules(
  groupId: string,
  payload: {
    userId: string;
    rules: string[];
    postingPolicy: string;
    guidelinesSummary?: string;
  }
): Promise<{ group: GroupItem }> {
  return apiJson(`/api/groups/${encodeURIComponent(groupId)}/rules`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function apiToggleGroupJoin(groupId: string, userId: string): Promise<{ group: GroupItem }> {
  return apiJson(`/api/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function apiAddTestimonial(payload: {
  authorId: string;
  recipientId: string;
  quote: string;
}): Promise<{ testimonial: TestimonialItem }> {
  return apiJson('/api/testimonials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiOpenThread(
  participantIds: string[],
  title?: string
): Promise<{ thread: MessageThread }> {
  return apiJson('/api/messages/thread', {
    method: 'POST',
    body: JSON.stringify({ participantIds, title }),
  });
}

export async function apiSendMessage(
  threadId: string,
  payload: {
    senderId: string;
    text: string;
    sharedPostId?: string;
    attachments?: AttachmentItem[];
  }
): Promise<{ thread: MessageThread }> {
  return apiJson(`/api/messages/${encodeURIComponent(threadId)}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiMarkThreadRead(threadId: string, userId: string): Promise<{ thread: MessageThread }> {
  return apiJson(`/api/messages/${encodeURIComponent(threadId)}/read`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function apiReactMessage(
  threadId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ thread: MessageThread }> {
  return apiJson(`/api/messages/${encodeURIComponent(threadId)}/react`, {
    method: 'POST',
    body: JSON.stringify({ messageId, userId, emoji }),
  });
}

export interface GifSearchItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  category: string;
}

export async function apiSearchGifs(
  q = '',
  category = 'All'
): Promise<{ items: GifSearchItem[]; categories: string[] }> {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set('q', q.trim());
  if (category && category !== 'All') qs.set('category', category);
  return apiJson(`/api/gifs/search?${qs.toString()}`);
}

export async function apiCreateGroupThread(payload: {
  creatorId: string;
  title: string;
  participantIds: string[];
  avatar?: string;
  avatarColor?: string;
  maxMembers?: number;
  autoAddCount?: number;
  autoAddCountry?: string;
  autoAddCategory?: string;
}): Promise<{ thread: MessageThread }> {
  return apiJson('/api/messages/group', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateThreadSettings(
  threadId: string,
  payload: {
    userId: string;
    title?: string;
    avatar?: string;
    avatarColor?: string;
  }
): Promise<{ thread: MessageThread }> {
  return apiJson(`/api/messages/${encodeURIComponent(threadId)}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function apiAddThreadMembers(
  threadId: string,
  payload: {
    memberIds?: string[];
    autoAddCount?: number;
    autoAddCountry?: string;
    autoAddCategory?: string;
  }
): Promise<{ thread: MessageThread }> {
  return apiJson(`/api/messages/${encodeURIComponent(threadId)}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface GroupMemberSummary {
  id: string;
  name: string;
  handle: string;
  location: string;
  avatar?: string;
  avatarColor: string;
  online: boolean;
  isAdmin: boolean;
}

export async function apiGetThreadMembers(
  threadId: string,
  params: { page?: number; limit?: number; q?: string } = {}
): Promise<{
  totalMembers: number;
  matchedCount: number;
  maxMembers: number;
  page: number;
  limit: number;
  members: GroupMemberSummary[];
}> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.q?.trim()) qs.set('q', params.q.trim());
  return apiJson(`/api/messages/${encodeURIComponent(threadId)}/members?${qs.toString()}`);
}

export async function apiStartLiveStream(payload: {
  authorId: string;
  title: string;
  privacy: PrivacyLevel;
  location?: string;
}): Promise<{ post: SocialPost }> {
  return apiJson('/api/livestreams/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiSendLiveChat(
  streamId: string,
  authorId: string,
  text: string
): Promise<{ chatMessage: LiveStreamComment; post: SocialPost }> {
  return apiJson(`/api/livestreams/${encodeURIComponent(streamId)}/chat`, {
    method: 'POST',
    body: JSON.stringify({ authorId, text }),
  });
}

export async function apiEndLiveStream(
  streamId: string,
  authorId: string,
  durationLabel: string
): Promise<{ post: SocialPost }> {
  return apiJson(`/api/livestreams/${encodeURIComponent(streamId)}/end`, {
    method: 'POST',
    body: JSON.stringify({ authorId, durationLabel }),
  });
}

export async function apiCreateAdCampaign(payload: {
  advertiserId: string;
  postId: string;
  title: string;
  objective: AdObjective;
  destinationUrl?: string;
  targetCountries: string[];
  targetLocations: string[];
  targetInterests: string[];
  targetAgeMin: number;
  targetAgeMax: number;
  dailyBudgetPhp: number;
  durationDays: number;
}): Promise<{ campaign: AdCampaign }> {
  return apiJson('/api/ads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiModerateAd(
  adId: string,
  reviewerId: string,
  status: AdStatus,
  moderationNote?: string
): Promise<{ campaign: AdCampaign }> {
  return apiJson(`/api/ads/${encodeURIComponent(adId)}/moderate`, {
    method: 'POST',
    body: JSON.stringify({ reviewerId, status, moderationNote }),
  });
}

export async function apiTrackAd(
  adId: string,
  viewerId: string,
  event: 'impression' | 'click' | 'engagement'
): Promise<{ campaign: AdCampaign }> {
  return apiJson(`/api/ads/${encodeURIComponent(adId)}/track`, {
    method: 'POST',
    body: JSON.stringify({ viewerId, event }),
  });
}

export async function apiCreateDonationDrive(payload: {
  organizerId: string;
  title: string;
  description: string;
  location: string;
  category: DonationDrive['category'];
  goalAmountPhp: number;
}): Promise<{ drive: DonationDrive }> {
  return apiJson('/api/donations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiPledgeDonation(
  driveId: string,
  donorId: string,
  amountPhp: number,
  note: string
): Promise<{ drive: DonationDrive }> {
  return apiJson(`/api/donations/${encodeURIComponent(driveId)}/pledge`, {
    method: 'POST',
    body: JSON.stringify({ donorId, amountPhp, note }),
  });
}

export async function apiSubmitSphereId(payload: {
  applicantUserId: string;
  category: 'verified_individual' | 'verified_organization';
  entityName: string;
  country: string;
  publicLink: string;
  govAgency?: string;
  govRegNumber?: string;
  notes: string;
  documentSummary: SphereIdVerificationRequest['documentSummary'];
}): Promise<{ request: SphereIdVerificationRequest }> {
  return apiJson('/api/verification-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiReviewSphereId(
  requestId: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
  reviewNote: string
): Promise<{ request: SphereIdVerificationRequest; user?: UserProfile }> {
  return apiJson(`/api/verification-requests/${encodeURIComponent(requestId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ reviewerId, decision, reviewNote }),
  });
}

export async function apiCreateAnonymousPost(payload: {
  authorId: string;
  topic: AnonymousTopic;
  title: string;
  content: string;
}): Promise<{ post: AnonymousPost }> {
  return apiJson('/api/anonymous', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiReplyAnonymousPost(
  postId: string,
  authorId: string,
  text: string
): Promise<{ post: AnonymousPost }> {
  return apiJson(`/api/anonymous/${encodeURIComponent(postId)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ authorId, text }),
  });
}

export async function apiVoteAnonymousPost(
  postId: string,
  userId: string,
  replyId?: string
): Promise<{ post: AnonymousPost }> {
  return apiJson(`/api/anonymous/${encodeURIComponent(postId)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ userId, replyId }),
  });
}

export async function apiReportAnonymousPost(
  postId: string,
  reporterId: string,
  reason: string
): Promise<{ post: AnonymousPost }> {
  return apiJson(`/api/anonymous/${encodeURIComponent(postId)}/report`, {
    method: 'POST',
    body: JSON.stringify({ reporterId, reason }),
  });
}

export async function apiMarkNotificationsRead(userId: string): Promise<{ ok: boolean }> {
  return apiJson('/api/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

// =========================================================================
// ACCOUNT SECURITY, IDENTITY VERIFICATION & RECOVERY CENTER APIs
// =========================================================================
export async function apiRequestEmailRecovery(email: string): Promise<{
  ok: boolean;
  deliveryChannel: string;
  message: string;
}> {
  return apiJson('/api/recovery/email/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiConfirmEmailRecovery(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; revokedSessions: number; message: string }> {
  return apiJson('/api/recovery/email/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function apiRequestPhoneRecoveryOtp(phone: string): Promise<{
  ok: boolean;
  expiresInSeconds: number;
  message: string;
}> {
  return apiJson('/api/recovery/phone/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function apiVerifyPhoneRecoveryOtp(
  phone: string,
  code: string
): Promise<{
  ok: boolean;
  referenceNumber: string;
  recoveryAuthToken: string;
  expiresAt: string;
}> {
  return apiJson('/api/recovery/phone/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

export async function apiSubmitGovIdRecovery(payload: {
  targetHandleOrId: string;
  purpose: 'account_recovery' | 'hybrid_identity_verification';
  legalFullName: string;
  dateOfBirth: string;
  idType: GovIdType;
  ownershipContext: string;
  privacyConsentAccepted: boolean;
  fileName: string;
  mimeType: string;
  dataBase64: string;
}): Promise<{
  ok: boolean;
  referenceNumber: string;
  status: RecoveryStatus;
  screening: {
    readabilityLabel: string;
    readabilityScore: number;
    discrepancies: string[];
    flags: string[];
    aiScreeningStatus: string;
  };
  retainUntil: string;
  privacyNoticeVersion: string;
}> {
  const res = await apiJson<{
    ok: boolean;
    referenceNumber: string;
    status: RecoveryStatus;
    screening: {
      readabilityLabel: string;
      readabilityScore: number;
      discrepancies: string[];
      flags: string[];
      aiScreeningStatus: string;
    };
    retainUntil: string;
    privacyNoticeVersion: string;
  }>('/api/recovery/gov-id/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.referenceNumber) {
    await syncRecoverySummaryToFirestore({
      id: res.referenceNumber,
      referenceNumber: res.referenceNumber,
      purpose: payload.purpose,
      idType: payload.idType,
    }).catch(() => {});
  }
  return res;
}

export interface RecoveryStatusResponse {
  referenceNumber: string;
  purpose: 'account_recovery' | 'hybrid_identity_verification';
  idType: GovIdType;
  status: RecoveryStatus;
  requestedAdditionalInfo?: string;
  rejectionReason?: string;
  escalatedToSeniorReviewer: boolean;
  screeningSummary: {
    readabilityLabel: string;
    readabilityScore: number;
    flagsCount: number;
    aiScreeningStatus: string;
  };
  documentDeletedAt?: string;
  documentRetainUntil: string;
  appeals: Array<{
    id: string;
    submittedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    decisionNote?: string;
    handledAt?: string;
  }>;
  timeline: Array<{
    action: string;
    actorRole: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export async function apiLookupRecoveryStatus(
  referenceNumber: string
): Promise<RecoveryStatusResponse> {
  return apiJson(`/api/recovery/status?referenceNumber=${encodeURIComponent(referenceNumber)}`);
}

export async function apiSubmitAdditionalRecoveryInfo(
  referenceNumber: string,
  payload: {
    responseText: string;
    fileName?: string;
    mimeType?: string;
    dataBase64?: string;
  }
): Promise<{ ok: boolean; status: RecoveryStatus }> {
  return apiJson(`/api/recovery/${encodeURIComponent(referenceNumber)}/additional-info`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiSubmitRecoveryAppeal(
  referenceNumber: string,
  payload: {
    explanation: string;
    fileName?: string;
    mimeType?: string;
    dataBase64?: string;
  }
): Promise<{ ok: boolean; status: RecoveryStatus }> {
  return apiJson(`/api/recovery/${encodeURIComponent(referenceNumber)}/appeal`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiCompleteRecovery(payload: {
  referenceNumber?: string;
  recoveryAuthToken: string;
  newPassword: string;
  newEmail?: string;
  newPhone?: string;
}): Promise<{
  ok: boolean;
  invalidatedSessions: number;
  sessionToken?: string;
  status: RecoveryStatus;
  message: string;
}> {
  const res = await apiJson<{
    ok: boolean;
    invalidatedSessions: number;
    sessionToken?: string;
    status: RecoveryStatus;
    message: string;
  }>('/api/recovery/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.sessionToken) setSphereSessionToken(res.sessionToken);
  return res;
}

export async function apiFetchSecurityOverview(): Promise<{
  summary: UserSecuritySummary;
  sessions: ActiveSessionRecord[];
  loginActivity: LoginActivityRecord[];
  identityRequests: Array<{
    id: string;
    referenceNumber: string;
    purpose: 'account_recovery' | 'hybrid_identity_verification';
    idType: GovIdType;
    status: RecoveryStatus;
    requestedAdditionalInfo?: string;
    rejectionReason?: string;
    documentRetainUntil: string;
    documentDeletedAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}> {
  return apiJson('/api/security/me');
}

export async function apiChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; revokedOtherSessions: number; message: string }> {
  return apiJson('/api/security/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function apiUpdateSecurityContact(payload: {
  email?: string;
  mobile?: string;
  recoveryEmailBackup?: string;
  securityNotificationsEnabled?: boolean;
}): Promise<{ ok: boolean; changedFields: string[] }> {
  const res = await apiJson<{ ok: boolean; changedFields: string[] }>('/api/security/contact', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (typeof payload.securityNotificationsEnabled === 'boolean' || payload.recoveryEmailBackup !== undefined) {
    await syncUserSecuritySettingsToFirestore({
      mfaEnabled: false,
      recoveryEmailBackup: payload.recoveryEmailBackup,
      securityNotificationsEnabled: payload.securityNotificationsEnabled ?? true,
    }).catch(() => {});
  }
  return res;
}

export async function apiRevokeSession(sessionId: string): Promise<{ ok: boolean }> {
  return apiJson(`/api/security/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function apiRevokeOtherSessions(): Promise<{ ok: boolean; revokedCount: number }> {
  return apiJson('/api/security/sessions/revoke-others', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function apiGetMfaSetup(): Promise<{
  mfaEnabled: boolean;
  mfaMethod: string;
  totpSecret: string;
  otpauthUrl: string;
}> {
  return apiJson('/api/security/mfa/setup');
}

export async function apiToggleMfa(
  enable: boolean,
  code: string
): Promise<{ ok: boolean; mfaEnabled: boolean }> {
  const res = await apiJson<{ ok: boolean; mfaEnabled: boolean }>('/api/security/mfa/toggle', {
    method: 'POST',
    body: JSON.stringify({ enable, code }),
  });
  await syncUserSecuritySettingsToFirestore({
    mfaEnabled: res.mfaEnabled,
    mfaMethod: 'authenticator_code',
    securityNotificationsEnabled: true,
  }).catch(() => {});
  return res;
}

export async function apiVerifyAdminMfa(
  code: string
): Promise<{ ok: boolean; adminMfaVerified: boolean }> {
  return apiJson('/api/security/mfa/admin-verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export interface OfficerQueueRequest extends RecoveryRequestRecord {
  hasDocument: boolean;
  documentDeleted: boolean;
}

export async function apiFetchVerificationQueue(params: {
  status?: string;
  q?: string;
} = {}): Promise<{
  stats: Record<string, number>;
  adminMfaVerified: boolean;
  requests: OfficerQueueRequest[];
}> {
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.q?.trim()) qs.set('q', params.q.trim());
  return apiJson(`/api/recovery/queue?${qs.toString()}`);
}

export async function apiSignRecoveryDocument(
  referenceNumber: string,
  documentId?: string
): Promise<{ signedUrl: string; expiresAt: number }> {
  return apiJson(`/api/recovery/${encodeURIComponent(referenceNumber)}/sign-document`, {
    method: 'POST',
    body: JSON.stringify({ documentId }),
  });
}

export async function apiSubmitVerificationDecision(
  referenceNumber: string,
  payload: {
    action: 'start_verification' | 'approve' | 'reject' | 'request_info' | 'escalate';
    reason?: string;
    note?: string;
    requestedInfo?: string;
  }
): Promise<{
  ok: boolean;
  request: OfficerQueueRequest;
  recoveryAuthToken?: string;
  recoveryAuthExpiresAt?: string;
}> {
  return apiJson(`/api/recovery/${encodeURIComponent(referenceNumber)}/decision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiFetchSecurityAuditLogs(eventType = 'all'): Promise<{
  chainIntegrity: { valid: boolean; totalEntries: number; brokenAtSeq?: number };
  logs: SecurityAuditLogEntry[];
}> {
  return apiJson(`/api/security/admin/audit-logs?eventType=${encodeURIComponent(eventType)}`);
}

export async function apiFetchSecurityAlerts(): Promise<{
  alerts: SuspiciousActivityAlert[];
}> {
  return apiJson('/api/security/admin/alerts');
}

export async function apiUpdateSecurityAlert(
  alertId: string,
  payload: { status?: 'open' | 'investigating' | 'resolved'; resolutionNote?: string }
): Promise<{ ok: boolean; alert: SuspiciousActivityAlert }> {
  return apiJson(`/api/security/admin/alerts/${encodeURIComponent(alertId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function apiTriggerRetentionPurge(purgeClosedNow = false): Promise<{
  ok: boolean;
  purgedCount: number;
  purgedDocumentIds: string[];
}> {
  return apiJson('/api/security/admin/retention-purge', {
    method: 'POST',
    body: JSON.stringify({ purgeClosedNow }),
  });
}

export interface PersonnelRosterItem {
  id: string;
  name: string;
  handle: string;
  email?: string;
  avatar?: string;
  avatarColor: string;
  securityRoles: SecurityRole[];
  mfaEnabled: boolean;
}

export async function apiFetchPersonnelRoles(q = ''): Promise<{
  personnel: PersonnelRosterItem[];
}> {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return apiJson(`/api/security/admin/roles${qs}`);
}

export async function apiUpdatePersonnelRoles(
  targetUserId: string,
  roles: SecurityRole[]
): Promise<{ ok: boolean; targetUserId: string; securityRoles: SecurityRole[] }> {
  return apiJson('/api/security/admin/roles', {
    method: 'POST',
    body: JSON.stringify({ targetUserId, roles }),
  });
}

