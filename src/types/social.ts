export type PrivacyLevel = 'public' | 'friends_of_friends' | 'friends_only' | 'only_me';
export type ReactionType = 'heart' | 'clap' | 'laugh' | 'fire';
export type VideoFormat = 'short' | 'long';
export type SphereIdCategory = 'verified_individual' | 'verified_organization' | 'unverified';
export type LocationScope = 'nearby' | 'city' | 'country' | 'global';
export type TagWallPermission = 'everyone' | 'friends' | 'no_one';
export type UserRole = 'admin' | 'member';
export type SecurityRole =
  | 'regular_user'
  | 'verification_officer'
  | 'senior_reviewer'
  | 'security_admin'
  | 'platform_admin';

export type GovIdType =
  | 'PhilSys National ID'
  | 'Philippine Passport'
  | "Driver's License"
  | 'UMID'
  | 'SSS ID'
  | 'PRC ID';

export type RecoveryMethod = 'email' | 'phone_otp' | 'government_id';

export type RecoveryStatus =
  | 'pending_review'
  | 'under_verification'
  | 'additional_info_required'
  | 'approved'
  | 'rejected'
  | 'appeal_under_review'
  | 'recovery_completed';

export type SecurityAuditEventType =
  | 'password_reset_request'
  | 'password_change'
  | 'otp_attempt'
  | 'recovery_request_submission'
  | 'id_document_view'
  | 'verification_decision'
  | 'appeal_submission'
  | 'role_change'
  | 'suspicious_activity_alert'
  | 'session_revoked'
  | 'mfa_updated'
  | 'contact_updated'
  | 'document_purged';

export type DiscoveryCategory =
  | 'Technology'
  | 'Gaming'
  | 'Art'
  | 'Music'
  | 'Travel'
  | 'Business'
  | 'Education'
  | 'Sports'
  | 'Lifestyle';

export type AnonymousTopic =
  | 'Personal Experiences'
  | 'Community Concerns'
  | 'Advice & Mentorship'
  | 'Ideas & Creativity'
  | 'General Discussions';

export interface PopularitySettings {
  hidePublicLikeCounts: boolean;
  hideFollowerCounts: boolean;
  disableProfileEngagementStats: boolean;
}

export interface TaggingSettings {
  enabled: boolean;
  whoCanTag: TagWallPermission;
  requireApproval: boolean;
}

export interface WallSharingSettings {
  enabled: boolean;
  whoCanPost: TagWallPermission;
  requireApproval: boolean;
}

export interface ReactionTracker {
  userReactions: Record<string, ReactionType>; // userId -> current active single reaction
  switchCounts: Record<string, number>; // userId -> number of switches made (max 3)
  lastReactedAt?: Record<string, number>; // userId -> timestamp ms for anti-flood
}

export interface SphereIdVerificationRequest {
  id: string;
  applicantUserId: string;
  applicantName: string;
  category: 'verified_individual' | 'verified_organization';
  entityName: string;
  country: string;
  publicLink: string;
  govAgency?: string;
  govRegNumber?: string;
  notes: string;
  documentSummary: {
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    sha256Short: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface AnonymousReport {
  id: string;
  reporterId: string;
  reason: string;
  createdAt: string;
}

export interface AnonymousReply {
  id: string;
  alias: string;
  authorId: string;
  text: string;
  createdAt: string;
  language?: string;
  supportiveVotes: string[];
  hidden?: boolean;
  reports?: AnonymousReport[];
}

export interface AnonymousPost {
  id: string;
  topic: AnonymousTopic;
  alias: string;
  authorId: string;
  title: string;
  content: string;
  createdAt: string;
  language?: string;
  supportiveVotes: string[];
  replies: AnonymousReply[];
  hidden?: boolean;
  reports: AnonymousReport[];
}

export type NavRoute =
  | { page: 'home'; hashtag?: string; location?: string; viewMode?: 'pulse' | 'orbit' }
  | { page: 'global'; tab?: 'circle' | 'find-people'; category?: DiscoveryCategory | 'All' }
  | { page: 'anonymous'; topic?: AnonymousTopic | 'All' }
  | { page: 'donations'; driveId?: string }
  | { page: 'ads' }
  | { page: 'privacy' }
  | {
      page: 'profile';
      userId: string;
      tab?: 'timeline' | 'about' | 'friends' | 'photos' | 'testimonials';
    }
  | { page: 'friends'; tab?: 'all' | 'requests' | 'discover' }
  | { page: 'marketplace'; category?: string; listingId?: string }
  | { page: 'messages'; threadId?: string }
  | {
      page: 'discover';
      tab?: 'trending' | 'videos' | 'live' | 'pages' | 'groups' | 'photos' | 'testimonials' | 'gaming';
      hashtag?: string;
      groupId?: string;
      pageId?: string;
    }
  | {
      page: 'search';
      query: string;
      filter?: 'all' | 'people' | 'pages' | 'posts' | 'groups' | 'photos';
    }
  | {
      page: 'recovery';
      initialTab?: 'email' | 'phone' | 'gov_id' | 'status' | 'appeal' | 'complete';
      referenceNumber?: string;
      token?: string;
    }
  | {
      page: 'security';
      section?: 'overview' | 'sessions' | 'mfa' | 'identity';
    }
  | { page: 'post'; postId: string }
  | {
      page: 'verification-dashboard';
      roleTab?: 'officer' | 'senior' | 'security_admin' | 'platform_admin';
    };

export type ShareDestinationType =
  | 'friends_message'
  | 'own_timeline'
  | 'friend_timeline'
  | 'groups'
  | 'external'
  | 'copy_link';

export interface PostShareRecord {
  id: string;
  originalPostId: string;
  sharedPostId?: string;
  originalAuthorId: string;
  sharingUserId: string;
  recipientUserId?: string;
  destinationType: ShareDestinationType;
  destinationGroupId?: string;
  caption?: string;
  platform?: string;
  createdAt: string;
  status: 'completed' | 'pending_approval' | 'blocked';
  idempotencyKey?: string;
}

export type FriendshipStatus = 'friends' | 'requested_outgoing' | 'requested_incoming' | 'none';

export interface UserProfile {
  id: string;
  role?: UserRole;
  name: string;
  handle: string;
  avatar?: string;
  avatarColor: string;
  coverImage?: string;
  status: string;
  location: string;
  country?: string;
  language?: string;
  preferredLanguage?: string;
  autoTranslate?: boolean;
  interests: string[];
  hobbies?: string[];
  skills?: string[];
  goals?: string[];
  categories?: DiscoveryCategory[];
  quote: string;
  bio: string;
  joinedDate: string;
  friendCount: number;
  photoCount: number;
  groupCount: number;
  friendship: FriendshipStatus;
  mutualFriends: number;
  privacy: PrivacyLevel;
  taggingSettings?: TaggingSettings;
  wallSharingSettings?: WallSharingSettings;
  popularitySettings?: PopularitySettings;
  sphereIdCategory?: SphereIdCategory;
  govAgency?: string;
  govRegNumber?: string;
  locationDiscoveryEnabled?: boolean;
  preferredScope?: LocationScope;
  email?: string;
  mobile?: string;
  password?: string;
  birthday?: string;
  gender?: string;
  verified?: boolean;
  firebaseUid?: string;
  occupation?: string;
  workplace?: string;
  education?: string;
  hometown?: string;
  relationshipStatus?: string;
  currentlyInto?: string;
  favoriteFood?: string;
  activeStatusLabel?: string;
  securityRoles?: SecurityRole[];
  mfaEnabled?: boolean;
  securityNotificationsEnabled?: boolean;
  recoveryEmailBackup?: string;
  blockedUserIds?: string[];
}

export interface PostComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
  likes: number;
  likedByMe?: boolean;
  language?: string;
  reactions?: Partial<Record<ReactionType, string[]>>;
  reactionTracker?: ReactionTracker;
}

export interface PostVibe {
  kind: 'Listening' | 'At' | 'Creating' | 'Reading' | 'Throwback';
  label: string;
}

export interface PostVideo {
  src: string;
  format: VideoFormat;
  title?: string;
  durationLabel?: string;
  durationSeconds?: number;
  poster?: string;
}

export interface LiveStreamComment {
  id: string;
  authorId: string;
  text: string;
  timestamp: string;
}

export interface LiveStreamData {
  id: string;
  title: string;
  isLive: boolean;
  viewerCount: number;
  durationLabel: string;
  coverImage?: string;
  chatMessages: LiveStreamComment[];
}

export interface SocialPost {
  id: string;
  authorId: string;
  targetProfileId?: string;
  wallApproved?: boolean; // undefined/true if approved or own post, false if awaiting target user's MySpace approval
  taggedUserIds?: string[];
  approvedTagUserIds?: string[];
  pendingTagUserIds?: string[];
  groupId?: string;
  pageId?: string;
  postAsPage?: boolean;
  content: string;
  location?: string;
  country?: string;
  language?: string;
  createdAt: string;
  likes: string[];
  reactions?: Partial<Record<ReactionType, string[]>>;
  reactionTracker?: ReactionTracker;
  comments: PostComment[];
  photoId?: string;
  video?: PostVideo;
  marketplaceItemId?: string;
  liveStream?: LiveStreamData;
  sharedPostId?: string;
  originalAuthorId?: string;
  shareDestination?: 'own_timeline' | 'friend_timeline' | 'groups';
  sharedOriginalState?: 'available' | 'deleted' | 'restricted';
  sharesCount: number;
  privacy?: PrivacyLevel;
  vibe?: PostVibe;
}

export interface PhotoItem {
  id: string;
  ownerId: string;
  pageId?: string;
  postAsPage?: boolean;
  groupId?: string;
  albumId?: string;
  mediaType?: 'image' | 'video';
  videoFormat?: VideoFormat;
  src: string;
  caption: string;
  location: string;
  album: string;
  createdAt: string;
  likes: string[];
  reactions?: Partial<Record<ReactionType, string[]>>;
  reactionTracker?: ReactionTracker;
  comments: PostComment[];
  privacy?: PrivacyLevel;
}

export interface AlbumItem {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  privacy: 'public' | 'friends_only' | 'only_me';
  coverPhotoId?: string;
  coverSrc?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceItem {
  id: string;
  sellerId: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  condition: 'Brand New' | 'Like New' | 'Good' | 'Vintage';
  location: string;
  description: string;
  imageSrc?: string;
  createdAt: string;
  privacy: PrivacyLevel;
  sold?: boolean;
  allowCommentsAndReactions?: boolean;
  reactions?: Partial<Record<ReactionType, string[]>>;
  reactionTracker?: ReactionTracker;
  comments?: PostComment[];
}

export interface GroupItem {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  privacy?: 'public' | 'private';
  creatorId?: string;
  coverImage?: string;
  accentColor: string;
  memberIds: string[];
  joined: boolean;
  totalMembers: number;
  rules?: string[];
  postingPolicy?: string;
  guidelinesSummary?: string;
  moderatorOnlyPosting?: boolean;
}

export interface PageItem {
  id: string;
  name: string;
  handle: string;
  category: string;
  description: string;
  location: string;
  ownerId: string;
  avatar?: string;
  coverImage?: string;
  accentColor: string;
  followerIds: string[];
  following: boolean;
  totalFollowers: number;
  verified?: boolean;
  sphereIdCategory?: SphereIdCategory;
  govAgency?: string;
  govRegNumber?: string;
  established?: string;
  highlights?: string[];
  contactInfo?: string;
  rules?: string[];
  postingPolicy?: string;
  guidelinesSummary?: string;
}

export interface TestimonialItem {
  id: string;
  authorId: string;
  recipientId: string;
  quote: string;
  createdAt: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'video' | 'audio' | 'gif' | 'sticker' | 'file';
  durationSeconds?: number;
  label?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  sharedPostId?: string;
  language?: string;
  attachments?: AttachmentItem[];
  reactions?: Record<string, string>; // userId -> emoji
  deliveredTo?: string[];
  readBy?: string[];
}

export interface MessageThread {
  id: string;
  participantIds: string[];
  title?: string;
  isGroup?: boolean;
  avatar?: string;
  avatarColor?: string;
  adminIds?: string[];
  maxMembers?: number;
  unreadCount: number;
  messages: DirectMessage[];
}

export type AdObjective = 'reach' | 'engagement' | 'traffic';
export type AdStatus = 'pending_review' | 'approved' | 'rejected' | 'paused';
export type AdBillingStatus = 'awaiting_payment_setup' | 'ready';

export interface AdCampaign {
  id: string;
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
  estimatedReachMin: number;
  estimatedReachMax: number;
  status: AdStatus;
  billingStatus: AdBillingStatus;
  moderationNote?: string;
  impressions: number;
  uniqueViewerIds: string[];
  clicks: number;
  engagements: number;
  createdAt: string;
  updatedAt: string;
}

export interface DonationPledge {
  id: string;
  donorId: string;
  donorName: string;
  amountPhp: number;
  note: string;
  createdAt: string;
}

export interface DonationDrive {
  id: string;
  organizerId: string;
  organizerName: string;
  govAgency: string;
  govRegNumber: string;
  title: string;
  description: string;
  location: string;
  category: 'Disaster Relief' | 'Food & Nutrition' | 'Medical Aid' | 'Education & Youth' | 'Livelihood';
  goalAmountPhp: number;
  raisedAmountPhp: number;
  coverImage?: string;
  verifiedGov: boolean;
  status: 'active' | 'completed';
  pledges: DonationPledge[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  type:
    | 'tag_request'
    | 'wall_request'
    | 'friend_request'
    | 'reaction'
    | 'comment'
    | 'ad_status'
    | 'donation'
    | 'security_alert'
    | 'recovery_update'
    | 'password_changed'
    | 'post_share'
    | 'group_share'
    | 'message_share';
  text: string;
  postId?: string;
  sharedPostId?: string;
  threadId?: string;
  groupId?: string;
  read: boolean;
  createdAt: string;
}

export interface ScreeningResult {
  passedInitialValidation: boolean;
  fileSizeBytes: number;
  mimeType: string;
  dimensions?: { width: number; height: number } | null;
  readabilityScore: number;
  readabilityLabel: 'Good' | 'Fair' | 'Poor';
  sha256Prefix: string;
  discrepancies: string[];
  flags: string[];
  extractedSummary?: {
    detectedDocType?: string;
    legibilityNotes?: string;
    nameMatchHint?: string;
    dobMatchHint?: string;
  } | null;
  aiScreeningStatus: 'completed' | 'skipped_no_api_key' | 'failed';
  screenedAt: string;
}

export interface RecoveryReviewHistoryEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: SecurityRole;
  action: string;
  note?: string;
  reason?: string;
  timestamp: string;
}

export interface RecoveryAppealRecord {
  id: string;
  submittedAt: string;
  explanation: string;
  additionalDocumentId?: string;
  status: 'pending' | 'approved' | 'rejected';
  handledById?: string;
  handledByName?: string;
  handledAt?: string;
  decisionNote?: string;
}

export interface RecoveryRequestRecord {
  id: string;
  referenceNumber: string;
  targetUserId?: string;
  targetHandleOrId: string;
  method: RecoveryMethod;
  purpose: 'account_recovery' | 'hybrid_identity_verification';
  legalFullName: string;
  dateOfBirth: string;
  idType: GovIdType;
  ownershipContext: string;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  status: RecoveryStatus;
  assignedOfficerId?: string;
  escalatedToSeniorReviewer?: boolean;
  rejectionReason?: string;
  requestedAdditionalInfo?: string;
  additionalInfoResponse?: string;
  documentRecordId?: string;
  documentDeletedAt?: string;
  documentRetainUntil: string;
  screening: ScreeningResult;
  reviewHistory: RecoveryReviewHistoryEntry[];
  appeals: RecoveryAppealRecord[];
  recoveryAuthIssuedAt?: string;
  recoveryAuthExpiresAt?: string;
  recoveryCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityAuditLogEntry {
  id: string;
  seq: number;
  timestamp: string;
  eventType: SecurityAuditEventType;
  actorId: string;
  actorRole: string;
  targetUserId?: string;
  referenceNumber?: string;
  ipAddress: string;
  outcome: 'success' | 'failure' | 'blocked' | 'flagged';
  details: string;
  prevHash: string;
  entryHash: string;
}

export interface SuspiciousActivityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  summary: string;
  targetUserId?: string;
  ipAddress: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
  investigatedBy?: string;
  resolutionNote?: string;
}

export interface ActiveSessionRecord {
  id: string;
  userId: string;
  deviceLabel: string;
  ipAddress: string;
  locationLabel: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current?: boolean;
  revoked?: boolean;
}

export interface LoginActivityRecord {
  id: string;
  userId: string;
  method: string;
  deviceLabel: string;
  ipAddress: string;
  outcome: 'success' | 'failed' | 'mfa_challenged';
  timestamp: string;
}

export interface UserSecuritySummary {
  hasPasswordSet: boolean;
  registeredEmail?: string;
  emailVerified: boolean;
  registeredPhone?: string;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  mfaMethod?: 'authenticator_code' | 'email_otp';
  mfaSecretPreview?: string;
  recoveryEmailBackup?: string;
  securityRoles: SecurityRole[];
  adminMfaVerified: boolean;
  identityVerificationStatus:
    | 'not_submitted'
    | 'pending_review'
    | 'under_verification'
    | 'additional_info_required'
    | 'verified'
    | 'rejected';
  latestIdentityRequestRef?: string;
  securityNotificationsEnabled: boolean;
}

export interface BootstrapPayload {
  users: UserProfile[];
  posts: SocialPost[];
  photos: PhotoItem[];
  albums: AlbumItem[];
  marketplace: MarketplaceItem[];
  groups: GroupItem[];
  pages: PageItem[];
  testimonials: TestimonialItem[];
  threads: MessageThread[];
  anonymousPosts: AnonymousPost[];
  verificationRequests: SphereIdVerificationRequest[];
  adCampaigns: AdCampaign[];
  donationDrives: DonationDrive[];
  notifications: NotificationItem[];
  shareRecords?: PostShareRecord[];
  onlineUserIds: string[];
  totalGlobalPopulation?: number;
}
