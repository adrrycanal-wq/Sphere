import {
  AdCampaign,
  AlbumItem,
  AnonymousPost,
  DonationDrive,
  GroupItem,
  MarketplaceItem,
  MessageThread,
  NotificationItem,
  PageItem,
  PhotoItem,
  PostShareRecord,
  SocialPost,
  SphereIdVerificationRequest,
  TestimonialItem,
  UserProfile,
} from '../src/types/social';
import { generateAnonymousAlias } from '../src/utils/discovery';
import { getCategoryGuidelines } from '../src/utils/communityRules';
import {
  BAKED_BY_BABY_OVERRIDES,
  createAdrian100Pages,
  LABO_PAGE_OVERRIDES,
  REALISTIC_COMMUNITY_USERS,
  REALISTIC_PAGE_STARTER_POSTS,
} from './seedPagesAndRules';
import { IMAGINARY_FRIEND_USERS } from './imaginaryFriends';
import { enrichUserLifeDetails, ensureFriendLifeActivity } from './friendLifeGenerator';
import { resolveUserSecurityRoles } from './securityVault';

function pickGuidelines(category: string, isGroup = false) {
  const g = getCategoryGuidelines(category, isGroup);
  return {
    rules: g.rules,
    postingPolicy: g.postingPolicy,
    guidelinesSummary: g.guidelinesSummary,
  };
}

export interface SphereDatabase {
  users: UserProfile[];
  friendships: Record<string, string[]>; // userId -> friendIds
  outgoingRequests: Record<string, string[]>; // userId -> targetIds
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
  shareRecords: PostShareRecord[];
  blockedUsers: Record<string, string[]>;
}

function formatMonthDayRelative(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `1996-${mm}-${dd}`;
}

export function createInitialSeed(): SphereDatabase {
  const users: UserProfile[] = [
    {
      id: 'adrian',
      role: 'admin',
      name: 'Adrian Canal Villanueva',
      handle: '@adriancanal',
      avatar: '/assets/aistudio/image_a7c7256c.png',
      avatarColor: '#4F46E5',
      coverImage: '/media-seed/bagasbas_sunrise_daet_1794746488854.jpg',
      status: 'Exploring local craft in Labo & connecting with makers across Sphere.',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      autoTranslate: false,
      interests: ['Community Building', 'Local Food', 'Photography', 'Design', 'Open Tech'],
      hobbies: ['Beach Walks', 'Coffee Roasting', 'Sketching', 'Cycling'],
      skills: ['Product Architecture', 'Community Strategy', 'Web Systems'],
      goals: ['Support Labo homegrown enterprises', 'Connect Bicol creatives globally'],
      categories: ['Technology', 'Lifestyle', 'Art'],
      quote: 'Build circles where real people actually feel seen.',
      bio: 'Father, builder, and community advocate based in Labo, Camarines Norte. Connecting neighbors, bakers, designers, and artists across Camarines Norte and beyond.',
      joinedDate: 'January 2024',
      friendCount: 6,
      photoCount: 4,
      groupCount: 3,
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
      sphereIdCategory: 'verified_individual',
      locationDiscoveryEnabled: true,
      preferredScope: 'nearby',
      email: 'adrrycanal@gmail.com',
      mobile: '09171234567',
      password: 'Password123!',
      birthday: '1993-05-14',
      gender: 'Male',
      verified: true,
    },
    {
      id: 'cherry',
      role: 'member',
      name: 'Cherry Celestial',
      handle: '@cherrycelestial',
      avatarColor: '#06B6D4',
      coverImage: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      status: 'Morning batch of pandesal and cheesy ensaymada just came out of the oven.',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      autoTranslate: false,
      interests: ['Artisan Baking', 'Sourdough', 'Local Food', 'Pastry Craft'],
      hobbies: ['Recipe Testing', 'Food Styling', 'Morning Markets'],
      skills: ['Artisan Baking', 'Fermentation', 'Small Batch Catering'],
      goals: ['Share Bicolano pastry traditions'],
      categories: ['Lifestyle', 'Business'],
      quote: 'Warm bread brings the whole barangay together.',
      bio: 'Artisan pastry baker at Balai Panaderia Labo. Slow-fermented loaves, pandesal, and weekend sweet trays.',
      joinedDate: 'February 2024',
      friendCount: 6,
      photoCount: 3,
      groupCount: 2,
      friendship: 'friends',
      mutualFriends: 5,
      privacy: 'public',
      taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: false },
      popularitySettings: {
        hidePublicLikeCounts: false,
        hideFollowerCounts: false,
        disableProfileEngagementStats: false,
      },
      sphereIdCategory: 'verified_individual',
      email: 'cherry@sphere.ph',
      password: 'Password123!',
      birthday: formatMonthDayRelative(2),
      gender: 'Female',
      verified: true,
    },
    {
      id: 'chermaine',
      role: 'member',
      name: 'Chermaine Villanueva',
      handle: '@chermainev',
      avatarColor: '#7C3AED',
      coverImage: '/media-seed/bagasbas_sunrise_daet_1794746488854.jpg',
      status: 'Chasing 5:30 AM light along Bagasbas shoreline.',
      location: 'Daet, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      autoTranslate: false,
      interests: ['35mm Film', 'Coastal Photography', 'Visual Storytelling', 'Surf Culture'],
      hobbies: ['Darkroom Prints', 'Surf Watching', 'Field Journaling'],
      skills: ['Documentary Photography', 'Color Grading'],
      goals: ['Publish a coastal Camarines Norte photo zine'],
      categories: ['Art', 'Travel'],
      quote: 'Every sunrise in Daet writes a new frame.',
      bio: 'Documentary & 35mm film photographer capturing everyday life across Daet, Bagasbas, and Labo.',
      joinedDate: 'March 2024',
      friendCount: 6,
      photoCount: 3,
      groupCount: 2,
      friendship: 'friends',
      mutualFriends: 5,
      privacy: 'friends_of_friends',
      taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
      sphereIdCategory: 'verified_individual',
      email: 'chermaine@sphere.ph',
      password: 'Password123!',
      birthday: '1995-08-22',
      gender: 'Female',
      verified: true,
    },
    {
      id: 'cherian',
      role: 'member',
      name: 'Cherian Faith Villanueva',
      handle: '@cherianfaith',
      avatarColor: '#0EA5E9',
      coverImage: '/media-seed/designer_studio_desk_1794746490487.jpg',
      status: 'Refining typography systems and packaging for local Bicolano brands.',
      location: 'Daet, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      autoTranslate: false,
      interests: ['Brand Design', 'UI Systems', 'Typography', 'Print Craft'],
      hobbies: ['Fountain Pens', 'Grid Sketching', 'Cafe Hopping'],
      skills: ['Brand Identity', 'Design Systems', 'Packaging'],
      goals: ['Help hometown businesses look world-class'],
      categories: ['Art', 'Technology', 'Business'],
      quote: 'Clarity and warmth never go out of style.',
      bio: 'Independent Brand & UI Designer running Cherian Design Lab in Daet. Obsessed with readable type and honest packaging.',
      joinedDate: 'March 2024',
      friendCount: 6,
      photoCount: 2,
      groupCount: 2,
      friendship: 'friends',
      mutualFriends: 5,
      privacy: 'public',
      taggingSettings: { enabled: true, whoCanTag: 'everyone', requireApproval: true },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
      sphereIdCategory: 'verified_individual',
      email: 'cherian@sphere.ph',
      password: 'Password123!',
      birthday: '1997-03-11',
      gender: 'Female',
      verified: true,
    },
    {
      id: 'flaneth',
      role: 'member',
      name: 'Flaneth Villanueva',
      handle: '@flanethv',
      avatarColor: '#EC4899',
      coverImage: '/media-seed/cassava_cake_labo_1794746488921.jpg',
      status: 'Grating fresh cassava and prepping macapuno custard trays for the weekend.',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      autoTranslate: false,
      interests: ['Kakanin', 'Home Baking', 'Heritage Recipes', 'Local Food'],
      hobbies: ['Gardening', 'Weekend Merienda', 'Culinary Notes'],
      skills: ['Traditional Kakanin', 'Cassava Cake', 'Pastry Prep'],
      goals: ['Preserve family kakanin recipes for the next generation'],
      categories: ['Lifestyle', 'Business'],
      quote: 'Good merienda slows down a busy highway.',
      bio: 'Home baker & heritage kakanin maker in Labo. Always happy to swap recipes and pasalubong tips.',
      joinedDate: 'April 2024',
      friendCount: 6,
      photoCount: 2,
      groupCount: 2,
      friendship: 'friends',
      mutualFriends: 5,
      privacy: 'friends_only',
      taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: false },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
      sphereIdCategory: 'verified_individual',
      email: 'flaneth@sphere.ph',
      password: 'Password123!',
      birthday: '1994-12-03',
      gender: 'Female',
      verified: true,
    },
    {
      id: 'batotten',
      role: 'member',
      name: 'Batotten Canal',
      handle: '@batottencanal',
      avatarColor: '#F59E0B',
      coverImage: '/media-seed/designer_studio_desk_1794746490487.jpg',
      status: 'Illustrating festival posters and character stickers for Busig-On week.',
      location: 'Manila, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      autoTranslate: false,
      interests: ['Illustration', 'Graphic Design', 'Gaming', 'Print Art'],
      hobbies: ['Indie Games', 'Vector Art', 'Vinyl Collecting'],
      skills: ['Editorial Illustration', 'Poster Design', 'Motion Graphics'],
      goals: ['Collaborate on local festival art from Manila'],
      categories: ['Art', 'Gaming'],
      quote: 'Draw something bold every single day.',
      bio: 'Graphic designer & illustrator based in Manila with roots in Camarines Norte.',
      joinedDate: 'April 2024',
      friendCount: 6,
      photoCount: 2,
      groupCount: 2,
      friendship: 'friends',
      mutualFriends: 5,
      privacy: 'public',
      taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: false },
      sphereIdCategory: 'verified_individual',
      email: 'batotten@sphere.ph',
      password: 'Password123!',
      birthday: '1995-01-19',
      gender: 'Male',
      verified: true,
    },
    {
      id: 'faye',
      role: 'member',
      name: 'Faye Celestial',
      handle: '@fayecelestial',
      avatarColor: '#10B981',
      coverImage: '/media-seed/artist_painting_studio_1794746490153.jpg',
      status: 'Painting coastal acrylic studies in the sunlit studio today.',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      autoTranslate: false,
      interests: ['Acrylic Painting', 'Botanical Sketching', 'Art', 'Local Crafts'],
      hobbies: ['Plein Air Painting', 'Sketchbooks', 'Plant Collecting'],
      skills: ['Canvas Painting', 'Watercolor', 'Workshop Facilitation'],
      goals: ['Host youth weekend painting workshops in Labo'],
      categories: ['Art', 'Education'],
      quote: 'Color remembers what words forget.',
      bio: 'Visual artist & painter in Labo, Camarines Norte. Sharing studio works-in-progress and community art gatherings.',
      joinedDate: 'May 2024',
      friendCount: 6,
      photoCount: 3,
      groupCount: 2,
      friendship: 'friends',
      mutualFriends: 5,
      privacy: 'public',
      taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: true },
      wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: true },
      sphereIdCategory: 'verified_individual',
      email: 'faye@sphere.ph',
      password: 'Password123!',
      birthday: formatMonthDayRelative(0), // Today! Triggers Birthday Greeting Suggestion
      gender: 'Female',
      verified: true,
    },
    // Verified Organization Account for Aid Drives & LGU updates
    {
      id: 'cnrelieforg',
      role: 'member',
      name: 'Camarines Norte Relief & Aid Foundation',
      handle: '@cnreliefaid',
      avatarColor: '#0D9488',
      coverImage: '/media-seed/labo_busigon_festival_1794746488196.jpg',
      status: 'Coordinating transparent barangay relief and school kit distributions across Camarines Norte.',
      location: 'Daet, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'Tagalog & English',
      preferredLanguage: 'English',
      interests: ['Disaster Relief', 'Community Aid', 'Education', 'Public Transparency'],
      hobbies: ['Volunteer Coordination'],
      skills: ['Logistics', 'Civic Aid'],
      goals: ['100% transparent public ledger for every barangay drive'],
      categories: ['Education', 'Lifestyle'],
      quote: 'Accountability is the heart of civic aid.',
      bio: 'Government-registered non-profit relief and civic foundation serving Labo, Daet, and neighboring towns in Camarines Norte.',
      joinedDate: 'January 2024',
      friendCount: 3,
      photoCount: 1,
      groupCount: 1,
      friendship: 'none',
      mutualFriends: 2,
      privacy: 'public',
      sphereIdCategory: 'verified_organization',
      govAgency: 'DSWD Field Office V / SEC',
      govRegNumber: 'DSWD-FO5-2023-0142',
      email: 'aid@cnrelief.org.ph',
      password: 'Password123!',
      verified: true,
    },
    // Global Circle Members (International + Multilingual)
    {
      id: 'kenji',
      role: 'member',
      name: 'Kenji Takahashi',
      handle: '@kenjitakahashi',
      avatarColor: '#3B82F6',
      coverImage: '/media-seed/designer_studio_desk_1794746490487.jpg',
      status: 'Minimalist UI grids and afternoon matcha in Shibuya.',
      location: 'Tokyo, Japan',
      country: 'Japan',
      language: 'Japanese & English',
      preferredLanguage: 'Japanese',
      interests: ['UI Systems', '35mm Film', 'Typography', 'Photography', 'Open Tech'],
      hobbies: ['Film Cameras', 'Coffee Roasting', 'Cycling'],
      skills: ['Design Systems', 'Frontend Craft'],
      goals: ['Exchange design notes with Southeast Asian studios'],
      categories: ['Technology', 'Art'],
      quote: 'Good interfaces feel quiet and human.',
      bio: 'Product designer and 35mm film hobbyist in Tokyo. Looking forward to creative exchanges across Asia.',
      joinedDate: 'June 2024',
      friendCount: 4,
      photoCount: 1,
      groupCount: 1,
      friendship: 'none',
      mutualFriends: 2,
      privacy: 'public',
      sphereIdCategory: 'verified_individual',
      email: 'kenji@sphere.jp',
      password: 'Password123!',
      birthday: '1992-09-10',
      verified: true,
    },
    {
      id: 'sofia',
      role: 'member',
      name: 'Sofia Morales',
      handle: '@sofiamorales',
      avatarColor: '#E11D48',
      coverImage: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      status: 'Testing naturally leavened brioche and cinnamon swirls in Madrid.',
      location: 'Madrid, Spain',
      country: 'Spain',
      language: 'Spanish & English',
      preferredLanguage: 'Spanish',
      interests: ['Artisan Baking', 'Sourdough', 'Local Food', 'Pastry Craft'],
      hobbies: ['Farmers Markets', 'Food Photography'],
      skills: ['Sourdough Fermentation', 'Pastry'],
      goals: ['Swap regional bread recipes with bakers worldwide'],
      categories: ['Lifestyle', 'Travel'],
      quote: 'Every country has a story told through bread.',
      bio: 'Neighborhood baker in Madrid exploring heritage grains and warm pastries.',
      joinedDate: 'July 2024',
      friendCount: 5,
      photoCount: 1,
      groupCount: 1,
      friendship: 'requested_incoming',
      mutualFriends: 1,
      privacy: 'public',
      sphereIdCategory: 'verified_individual',
      email: 'sofia@sphere.es',
      password: 'Password123!',
      birthday: '1991-04-04',
      verified: true,
    },
    {
      id: 'minji',
      role: 'member',
      name: 'Min-ji Park',
      handle: '@minjipark',
      avatarColor: '#8B5CF6',
      coverImage: '/media-seed/artist_painting_studio_1794746490153.jpg',
      status: 'Glazing ceramic mugs and sketching in Seongsu-dong.',
      location: 'Seoul, South Korea',
      country: 'South Korea',
      language: 'Korean & English',
      preferredLanguage: 'Korean',
      interests: ['Illustration', 'Art', 'Acrylic Painting', 'Design'],
      hobbies: ['Ceramics', 'Sketchbooks', 'Indie Exhibitions'],
      skills: ['Illustration', 'Ceramic Glazing'],
      goals: ['Co-host a pan-Asian sketchbook swap'],
      categories: ['Art', 'Lifestyle'],
      quote: 'Hands in clay, mind at ease.',
      bio: 'Illustrator and ceramicist in Seoul sharing studio routines and creative prompts.',
      joinedDate: 'August 2024',
      friendCount: 3,
      photoCount: 1,
      groupCount: 1,
      friendship: 'none',
      mutualFriends: 1,
      privacy: 'public',
      sphereIdCategory: 'verified_individual',
      email: 'minji@sphere.kr',
      password: 'Password123!',
      birthday: '1996-06-18',
      verified: true,
    },
    ...REALISTIC_COMMUNITY_USERS,
    ...IMAGINARY_FRIEND_USERS,
  ];

  const friendships: Record<string, string[]> = {
    adrian: [
      'cherry',
      'chermaine',
      'cherian',
      'flaneth',
      'batotten',
      'faye',
      'marco-tech',
      'clarisse-sw',
      'paolo-moto',
      'harley-arts',
      'mateo-agri',
      ...IMAGINARY_FRIEND_USERS.map((u) => u.id),
    ],
    cherry: ['adrian', 'chermaine', 'cherian', 'flaneth', 'batotten', 'faye'],
    chermaine: ['adrian', 'cherry', 'cherian', 'flaneth', 'batotten', 'faye'],
    cherian: ['adrian', 'cherry', 'chermaine', 'flaneth', 'batotten', 'faye'],
    flaneth: ['adrian', 'cherry', 'chermaine', 'cherian', 'batotten', 'faye'],
    batotten: ['adrian', 'cherry', 'chermaine', 'cherian', 'flaneth', 'faye'],
    faye: ['adrian', 'cherry', 'chermaine', 'cherian', 'flaneth', 'batotten'],
    'marco-tech': ['adrian'],
    'clarisse-sw': ['adrian'],
    'paolo-moto': ['adrian'],
    'harley-arts': ['adrian'],
    'mateo-agri': ['adrian'],
  };

  for (const imf of IMAGINARY_FRIEND_USERS) {
    friendships[imf.id] = ['adrian'];
  }
  users[0].friendCount = friendships.adrian.length;

  const pages: PageItem[] = [
    {
      id: 'page-bakedbybaby',
      name: BAKED_BY_BABY_OVERRIDES.name!,
      handle: BAKED_BY_BABY_OVERRIDES.handle!,
      category: BAKED_BY_BABY_OVERRIDES.category!,
      description: BAKED_BY_BABY_OVERRIDES.description!,
      location: BAKED_BY_BABY_OVERRIDES.location!,
      ownerId: BAKED_BY_BABY_OVERRIDES.ownerId!,
      avatar: BAKED_BY_BABY_OVERRIDES.avatar!,
      coverImage: BAKED_BY_BABY_OVERRIDES.coverImage!,
      accentColor: BAKED_BY_BABY_OVERRIDES.accentColor!,
      followerIds: ['adrian', 'cherry', 'chermaine', 'cherian', 'faye', 'batotten'],
      following: true,
      totalFollowers: 3420,
      verified: true,
      sphereIdCategory: 'verified_organization',
      established: BAKED_BY_BABY_OVERRIDES.established,
      contactInfo: BAKED_BY_BABY_OVERRIDES.contactInfo,
      highlights: BAKED_BY_BABY_OVERRIDES.highlights,
      rules: BAKED_BY_BABY_OVERRIDES.rules,
      postingPolicy: BAKED_BY_BABY_OVERRIDES.postingPolicy,
      guidelinesSummary: BAKED_BY_BABY_OVERRIDES.guidelinesSummary,
    },
    {
      id: 'page-labo-lgu',
      name: LABO_PAGE_OVERRIDES.name!,
      handle: LABO_PAGE_OVERRIDES.handle!,
      category: LABO_PAGE_OVERRIDES.category!,
      description: LABO_PAGE_OVERRIDES.description!,
      location: LABO_PAGE_OVERRIDES.location!,
      ownerId: LABO_PAGE_OVERRIDES.ownerId!,
      avatar: LABO_PAGE_OVERRIDES.avatar!,
      coverImage: LABO_PAGE_OVERRIDES.coverImage!,
      accentColor: LABO_PAGE_OVERRIDES.accentColor!,
      followerIds: ['adrian', 'cherry', 'chermaine', 'cherian', 'flaneth', 'faye', 'batotten'],
      following: true,
      totalFollowers: 18650,
      verified: true,
      sphereIdCategory: 'verified_organization',
      govAgency: LABO_PAGE_OVERRIDES.govAgency,
      govRegNumber: LABO_PAGE_OVERRIDES.govRegNumber,
      established: LABO_PAGE_OVERRIDES.established,
      contactInfo: LABO_PAGE_OVERRIDES.contactInfo,
      highlights: LABO_PAGE_OVERRIDES.highlights,
      rules: LABO_PAGE_OVERRIDES.rules,
      postingPolicy: LABO_PAGE_OVERRIDES.postingPolicy,
      guidelinesSummary: LABO_PAGE_OVERRIDES.guidelinesSummary,
    },
    {
      id: 'page-balai-panaderia',
      name: 'Balai Panaderia Labo',
      handle: '@balaipanaderia',
      category: 'Artisan Bakery',
      description:
        'Small-batch pandesal, cheesy ensaymada, and country sourdough baked fresh every dawn in Labo, Camarines Norte.',
      location: 'Labo, Camarines Norte, Philippines',
      ownerId: 'cherry',
      avatar: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      coverImage: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      accentColor: '#06B6D4',
      followerIds: ['adrian', 'flaneth', 'faye', 'sofia'],
      following: true,
      totalFollowers: 920,
      verified: true,
      sphereIdCategory: 'verified_individual',
      ...pickGuidelines('Artisan Bakery'),
    },
    {
      id: 'page-cherian-lab',
      name: 'Cherian Design Lab',
      handle: '@cheriandesign',
      category: 'Design Studio',
      description:
        'Brand identity, typography, and packaging studio in Daet helping Camarines Norte makers stand out.',
      location: 'Daet, Camarines Norte, Philippines',
      ownerId: 'cherian',
      avatar: '/media-seed/designer_studio_desk_1794746490487.jpg',
      coverImage: '/media-seed/designer_studio_desk_1794746490487.jpg',
      accentColor: '#4F46E5',
      followerIds: ['adrian', 'batotten', 'kenji'],
      following: true,
      totalFollowers: 645,
      verified: true,
      sphereIdCategory: 'verified_individual',
      ...pickGuidelines('Design Studio'),
    },
    ...createAdrian100Pages(),
  ];

  const groups: GroupItem[] = [
    {
      id: 'grp-labo-makers',
      name: 'Labo & Daet Makers Circle',
      category: 'Community & Craft',
      description: 'Bakers, designers, photographers, and local business owners across Camarines Norte sharing events and collaborations.',
      location: 'Labo & Daet, Camarines Norte',
      privacy: 'public',
      creatorId: 'adrian',
      coverImage: '/media-seed/sphere_hero_community_1794746490268.jpg',
      accentColor: '#4F46E5',
      memberIds: ['adrian', 'cherry', 'chermaine', 'cherian', 'flaneth', 'faye'],
      joined: true,
      totalMembers: 342,
      ...pickGuidelines('Community & Craft', true),
    },
    {
      id: 'grp-bakers-exchange',
      name: 'Bicol & Global Bakers Circle',
      category: 'Food & Baking',
      description: 'Swap sourdough hydration notes, cassava cake tips, and pastry recipes across borders.',
      location: 'Labo · Madrid · Global',
      privacy: 'public',
      creatorId: 'cherry',
      coverImage: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      accentColor: '#06B6D4',
      memberIds: ['adrian', 'cherry', 'flaneth', 'sofia'],
      joined: true,
      totalMembers: 518,
      ...pickGuidelines('Food & Baking', true),
    },
    {
      id: 'grp-design-sketch',
      name: 'CamNorte Design & Sketchbook Vault',
      category: 'Art & Design',
      description: 'Private peer critique circle for brand designers, illustrators, and painters.',
      location: 'Daet · Manila · Seoul',
      privacy: 'private',
      creatorId: 'cherian',
      coverImage: '/media-seed/designer_studio_desk_1794746490487.jpg',
      accentColor: '#7C3AED',
      memberIds: ['adrian', 'cherian', 'batotten', 'faye', 'minji'],
      joined: true,
      totalMembers: 89,
      ...pickGuidelines('Art & Design', true),
    },
    {
      id: 'grp-hardware-builders',
      name: 'CamNorte PC Builders & Tech Rescue',
      category: 'Computer Parts & Hardware',
      description: 'Help neighbors pick reliable GPUs, PSUs, UPS backups, and troubleshoot PC hardware issues.',
      location: 'Labo · Daet · Bicol',
      privacy: 'public',
      creatorId: 'adrian',
      coverImage: '/media-seed/designer_studio_desk_1794746490487.jpg',
      accentColor: '#2563EB',
      memberIds: ['adrian', 'marco-tech', 'gabriel-dev'],
      joined: true,
      totalMembers: 214,
      ...pickGuidelines('Computer Parts & Hardware', true),
    },
    {
      id: 'grp-labo-social-works',
      name: 'Labo Barangay Volunteers & Outreach',
      category: 'Social Works & Outreach',
      description: 'Transparent school kit packing, river cleanups, and barangay calamity readiness planning.',
      location: 'Labo, Camarines Norte',
      privacy: 'public',
      creatorId: 'clarisse-sw',
      coverImage: '/media-seed/sphere_hero_community_1794746490268.jpg',
      accentColor: '#0D9488',
      memberIds: ['adrian', 'clarisse-sw', 'cherry', 'cnrelieforg'],
      joined: true,
      totalMembers: 410,
      ...pickGuidelines('Social Works & Outreach', true),
    },
    {
      id: 'grp-bicol-safe-riders',
      name: 'Bicol Safe Throttle & Touring Circle',
      category: 'Motorcycles & Riding',
      description: 'Weekend coffee rides, ATGATT gear checks, and rainy highway safety alerts across Camarines Norte and Sur.',
      location: 'Labo · Daet · Naga',
      privacy: 'public',
      creatorId: 'paolo-moto',
      coverImage: '/media-seed/bagasbas_sunrise_daet_1794746488854.jpg',
      accentColor: '#DC2626',
      memberIds: ['adrian', 'paolo-moto', 'nico-davao'],
      joined: true,
      totalMembers: 278,
      ...pickGuidelines('Motorcycles & Riding', true),
    },
  ];

  const albums: AlbumItem[] = [
    {
      id: 'alb-labo-heritage',
      ownerId: 'adrian',
      name: 'Labo & Bagasbas Moments',
      description: 'Sunrises in Daet, town festivals, and community gatherings around Labo.',
      privacy: 'public',
      coverPhotoId: 'ph-busigon',
      coverSrc: '/media-seed/labo_busigon_festival_1794746488196.jpg',
      createdAt: '2026-10-12',
      updatedAt: '2026-11-10',
    },
    {
      id: 'alb-family-vault',
      ownerId: 'adrian',
      name: 'Private Weekend Sketches',
      description: 'Personal reference photos kept private in Only Me.',
      privacy: 'only_me',
      coverPhotoId: 'ph-sunrise',
      coverSrc: '/media-seed/bagasbas_sunrise_daet_1794746488854.jpg',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-12',
    },
    {
      id: 'alb-cherry-bakes',
      ownerId: 'cherry',
      name: 'Balai Panaderia Bakes',
      description: 'Morning pandesal, ensaymada, and sourdough batches.',
      privacy: 'public',
      coverPhotoId: 'ph-bakery',
      coverSrc: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      createdAt: '2026-10-20',
      updatedAt: '2026-11-14',
    },
  ];

  const photos: PhotoItem[] = [
    {
      id: 'ph-cassava',
      ownerId: 'flaneth',
      pageId: 'page-bakedbybaby',
      postAsPage: true,
      src: '/media-seed/cassava_cake_labo_1794746488921.jpg',
      caption: 'Freshly baked golden Cassava Cake trays with caramelized macapuno custard at Maharlika Highway, Labo.',
      location: 'Maharlika Highway, Labo, Camarines Norte',
      album: 'Baked by Baby Showcase',
      createdAt: '25 mins ago',
      likes: ['adrian', 'cherry', 'faye'],
      reactions: { heart: ['adrian', 'cherry'], fire: ['faye'] },
      reactionTracker: {
        userReactions: { adrian: 'heart', cherry: 'heart', faye: 'fire' },
        switchCounts: {},
      },
      comments: [
        {
          id: 'c-ph1',
          authorId: 'cherry',
          text: 'The macapuno topping is always worth stopping along the highway for!',
          createdAt: '18 mins ago',
          likes: 2,
          reactions: { heart: ['flaneth', 'adrian'] },
          reactionTracker: { userReactions: { flaneth: 'heart', adrian: 'heart' }, switchCounts: {} },
        },
      ],
      privacy: 'public',
    },
    {
      id: 'ph-busigon',
      ownerId: 'adrian',
      pageId: 'page-labo-lgu',
      postAsPage: true,
      albumId: 'alb-labo-heritage',
      src: '/media-seed/labo_busigon_festival_1794746488196.jpg',
      caption: 'Busig-On Festival grand street parade and cultural showcase at Labo Town Plaza!',
      location: 'Labo, Camarines Norte, Philippines',
      album: 'Labo & Bagasbas Moments',
      createdAt: '1 hour ago',
      likes: ['adrian', 'cherry', 'chermaine', 'cherian', 'faye', 'batotten'],
      reactions: { heart: ['adrian', 'faye'], clap: ['cherry', 'chermaine', 'cherian', 'batotten'] },
      reactionTracker: {
        userReactions: {
          adrian: 'heart',
          faye: 'heart',
          cherry: 'clap',
          chermaine: 'clap',
          cherian: 'clap',
          batotten: 'clap',
        },
        switchCounts: {},
      },
      comments: [
        {
          id: 'c-ph2',
          authorId: 'faye',
          text: 'So proud seeing our barangay contingents bring Labo folklore to life!',
          createdAt: '40 mins ago',
          likes: 3,
          reactions: { clap: ['adrian', 'cherry'] },
          reactionTracker: { userReactions: { adrian: 'clap', cherry: 'clap' }, switchCounts: {} },
        },
      ],
      privacy: 'public',
    },
    {
      id: 'ph-bakery',
      ownerId: 'cherry',
      pageId: 'page-balai-panaderia',
      postAsPage: false,
      albumId: 'alb-cherry-bakes',
      src: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      caption: '6:00 AM counter spread: hot pandesal, cheesy ensaymada, and 24-hour country sourdough.',
      location: 'Labo, Camarines Norte, Philippines',
      album: 'Balai Panaderia Bakes',
      createdAt: '2 hours ago',
      likes: ['adrian', 'flaneth', 'sofia'],
      reactions: { heart: ['adrian', 'sofia'], fire: ['flaneth'] },
      reactionTracker: { userReactions: { adrian: 'heart', sofia: 'heart', flaneth: 'fire' }, switchCounts: {} },
      comments: [],
      privacy: 'public',
    },
    {
      id: 'ph-sunrise',
      ownerId: 'chermaine',
      src: '/media-seed/bagasbas_sunrise_daet_1794746488854.jpg',
      caption: 'First light at Bagasbas Beach before the morning surfers paddled out.',
      location: 'Daet, Camarines Norte, Philippines',
      album: 'Bagasbas 35mm',
      createdAt: '4 hours ago',
      likes: ['adrian', 'cherian', 'faye'],
      reactions: { heart: ['adrian', 'cherian', 'faye'] },
      reactionTracker: { userReactions: { adrian: 'heart', cherian: 'heart', faye: 'heart' }, switchCounts: {} },
      comments: [],
      privacy: 'friends_of_friends',
    },
    {
      id: 'ph-design',
      ownerId: 'cherian',
      pageId: 'page-cherian-lab',
      postAsPage: false,
      src: '/media-seed/designer_studio_desk_1794746490487.jpg',
      caption: 'Typography grids and Pantone proofs for a new Camarines Norte coffee & pasalubong brand.',
      location: 'Daet, Camarines Norte, Philippines',
      album: 'Studio Process',
      createdAt: '6 hours ago',
      likes: ['adrian', 'batotten', 'kenji'],
      reactions: { clap: ['adrian', 'batotten', 'kenji'] },
      reactionTracker: { userReactions: { adrian: 'clap', batotten: 'clap', kenji: 'clap' }, switchCounts: {} },
      comments: [],
      privacy: 'public',
    },
    {
      id: 'ph-studio',
      ownerId: 'faye',
      src: '/media-seed/artist_painting_studio_1794746490153.jpg',
      caption: 'Finished the coastal acrylic layer today in Labo. Ready for framing this weekend.',
      location: 'Labo, Camarines Norte, Philippines',
      album: 'Studio Canvases',
      createdAt: 'Yesterday',
      likes: ['adrian', 'chermaine', 'minji'],
      reactions: { heart: ['adrian', 'minji'], fire: ['chermaine'] },
      reactionTracker: { userReactions: { adrian: 'heart', minji: 'heart', chermaine: 'fire' }, switchCounts: {} },
      comments: [],
      privacy: 'public',
    },
    {
      id: 'ph-community',
      ownerId: 'adrian',
      albumId: 'alb-labo-heritage',
      src: '/media-seed/sphere_hero_community_1794746490268.jpg',
      caption: 'Weekend makers merienda in Labo—bakers, illustrators, and photographers sharing ideas.',
      location: 'Labo, Camarines Norte, Philippines',
      album: 'Labo & Bagasbas Moments',
      createdAt: '2 days ago',
      likes: ['cherry', 'chermaine', 'cherian', 'faye'],
      reactions: { heart: ['cherry', 'faye'], clap: ['chermaine', 'cherian'] },
      reactionTracker: {
        userReactions: { cherry: 'heart', faye: 'heart', chermaine: 'clap', cherian: 'clap' },
        switchCounts: {},
      },
      comments: [],
      privacy: 'public',
    },
  ];

  const marketplace: MarketplaceItem[] = [
    {
      id: 'mkt-cassava',
      sellerId: 'flaneth',
      title: 'Baked by Baby Signature Cassava Cake (Whole Tray)',
      price: 280,
      currency: 'PHP',
      category: 'Bakery & Food',
      condition: 'Brand New',
      location: 'Maharlika Highway, Labo, Camarines Norte',
      description:
        'Freshly baked daily along Maharlika Highway, Labo! Made from freshly grated cassava, coconut cream, and rich caramelized macapuno custard. Packed in travel-ready pasalubong boxes for byaheros.',
      imageSrc: '/media-seed/cassava_cake_labo_1794746488921.jpg',
      createdAt: '25 mins ago',
      privacy: 'public',
      sold: false,
      allowCommentsAndReactions: true,
      reactions: { heart: ['adrian', 'cherry'], fire: ['batotten'] },
      reactionTracker: { userReactions: { adrian: 'heart', cherry: 'heart', batotten: 'fire' }, switchCounts: {} },
      comments: [
        {
          id: 'mc-1',
          authorId: 'adrian',
          text: 'Reserve two boxes for our family trip to Manila tomorrow morning!',
          createdAt: '15 mins ago',
          likes: 1,
          reactions: { heart: ['flaneth'] },
          reactionTracker: { userReactions: { flaneth: 'heart' }, switchCounts: {} },
        },
      ],
    },
    {
      id: 'mkt-ensaymada',
      sellerId: 'cherry',
      title: 'Balai Panaderia Morning Box (6 Cheesy Ensaymada + Pandesal)',
      price: 340,
      currency: 'PHP',
      category: 'Bakery & Food',
      condition: 'Brand New',
      location: 'Labo, Camarines Norte',
      description:
        'Soft brioche ensaymada topped with whipped butter and aged edam cheese, paired with 12 warm pugon-style pandesal. Pre-order for morning pickup.',
      imageSrc: '/media-seed/artisan_bakery_table_1794746488917.jpg',
      createdAt: '2 hours ago',
      privacy: 'public',
      sold: false,
      allowCommentsAndReactions: false, // Demonstrates seller disabling comments/reactions -> Message Seller only!
      reactions: {},
      comments: [],
    },
    {
      id: 'mkt-canvas',
      sellerId: 'faye',
      title: 'Original Coastal Acrylic Canvas (18x24 in) — Framed',
      price: 3200,
      currency: 'PHP',
      category: 'Art & Prints',
      condition: 'Brand New',
      location: 'Labo, Camarines Norte',
      description:
        'Hand-painted acrylic on stretched cotton canvas inspired by Camarines Norte shores. Includes solid acacia float frame.',
      imageSrc: '/media-seed/artist_painting_studio_1794746490153.jpg',
      createdAt: 'Yesterday',
      privacy: 'public',
      sold: false,
      allowCommentsAndReactions: true,
      reactions: { heart: ['adrian', 'cherian'] },
      reactionTracker: { userReactions: { adrian: 'heart', cherian: 'heart' }, switchCounts: {} },
      comments: [],
    },
    {
      id: 'mkt-brandkit',
      sellerId: 'cherian',
      title: 'Small Business Packaging & Stamp Kit Consultation',
      price: 1500,
      currency: 'PHP',
      category: 'Design & Craft',
      condition: 'Brand New',
      location: 'Daet, Camarines Norte',
      description:
        'Custom kraft box sticker layout, logo refresh, and print-ready dielines tailored for local bakers and makers in Camarines Norte.',
      imageSrc: '/media-seed/designer_studio_desk_1794746490487.jpg',
      createdAt: '2 days ago',
      privacy: 'public',
      sold: false,
      allowCommentsAndReactions: true,
      reactions: { clap: ['cherry'] },
      reactionTracker: { userReactions: { cherry: 'clap' }, switchCounts: {} },
      comments: [],
    },
  ];

  const posts: SocialPost[] = [
    {
      id: 'post-bakedbybaby',
      authorId: 'flaneth',
      pageId: 'page-bakedbybaby',
      postAsPage: true,
      content:
        'Mainit-init pa ang bagong ahon na Cassava Cake! Sa mga byahero at pamilyang dadaan sa kahabaan ng Maharlika Highway dito sa Labo, bukas na po ang counter para sa pasalubong boxes. #BakedByBaby #LaboFood #CassavaCake',
      location: 'Maharlika Highway, Labo, Camarines Norte',
      country: 'Philippines',
      language: 'Tagalog',
      createdAt: '25 mins ago',
      likes: ['adrian', 'cherry', 'faye', 'batotten'],
      reactions: { heart: ['adrian', 'cherry'], fire: ['faye', 'batotten'] },
      reactionTracker: {
        userReactions: { adrian: 'heart', cherry: 'heart', faye: 'fire', batotten: 'fire' },
        switchCounts: {},
      },
      comments: [
        {
          id: 'pc-1',
          authorId: 'adrian',
          text: 'Always our favorite stop along Maharlika Highway! Reserved two trays for tomorrow.',
          createdAt: '15 mins ago',
          likes: 2,
          reactions: { heart: ['flaneth', 'cherry'] },
          reactionTracker: { userReactions: { flaneth: 'heart', cherry: 'heart' }, switchCounts: {} },
        },
      ],
      photoId: 'ph-cassava',
      marketplaceItemId: 'mkt-cassava',
      sharesCount: 6,
      privacy: 'public',
      vibe: { kind: 'At', label: 'Baked by Baby Kitchen, Labo' },
    },
    {
      id: 'post-busigon',
      authorId: 'adrian',
      pageId: 'page-labo-lgu',
      postAsPage: true,
      content:
        'Official Busig-On Festival Advisory: Join us at the Labo Town Plaza for the Grand Cultural Street Parade, local artisans showcase, and evening heritage concert celebrating the courage and hospitality of Laboenos! #BusigOnFestival #MunicipalityOfLabo #CamarinesNorte',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'English',
      createdAt: '1 hour ago',
      likes: ['adrian', 'cherry', 'chermaine', 'cherian', 'flaneth', 'faye', 'batotten'],
      reactions: {
        heart: ['adrian', 'faye', 'flaneth'],
        clap: ['cherry', 'chermaine', 'cherian', 'batotten'],
      },
      reactionTracker: {
        userReactions: {
          adrian: 'heart',
          faye: 'heart',
          flaneth: 'heart',
          cherry: 'clap',
          chermaine: 'clap',
          cherian: 'clap',
          batotten: 'clap',
        },
        switchCounts: {},
      },
      comments: [
        {
          id: 'pc-2',
          authorId: 'batotten',
          text: 'Heading home from Manila this weekend just in time for the street parade!',
          createdAt: '45 mins ago',
          likes: 3,
          reactions: { fire: ['adrian', 'chermaine'] },
          reactionTracker: { userReactions: { adrian: 'fire', chermaine: 'fire' }, switchCounts: {} },
        },
      ],
      photoId: 'ph-busigon',
      sharesCount: 14,
      privacy: 'public',
      vibe: { kind: 'At', label: 'Labo Town Plaza' },
    },
    {
      id: 'post-cherry-bakery',
      authorId: 'cherry',
      pageId: 'page-balai-panaderia',
      postAsPage: false,
      taggedUserIds: ['adrian'],
      approvedTagUserIds: ['adrian'],
      pendingTagUserIds: [],
      content:
        'Pulled the first pandesal, cheesy ensaymada, and 24-hour sourdough batch out of the oven at 6:00 AM. Drop by if you want warm coffee and bread before work! #BalaiPanaderia #LaboMakers',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'English',
      createdAt: '2 hours ago',
      likes: ['adrian', 'flaneth', 'sofia'],
      reactions: { heart: ['adrian', 'sofia'], fire: ['flaneth'] },
      reactionTracker: { userReactions: { adrian: 'heart', sofia: 'heart', flaneth: 'fire' }, switchCounts: {} },
      comments: [],
      photoId: 'ph-bakery',
      sharesCount: 2,
      privacy: 'public',
      vibe: { kind: 'Creating', label: 'Morning Batch · Balai Panaderia' },
    },
    {
      id: 'post-kenji-tokyo',
      authorId: 'kenji',
      content:
        '渋谷の小さなカフェで新しいUIグリッドとタイポグラフィのテスト中。フィリピンのクリエイターたちとデザインノートを交換できるのが楽しみです！ #DesignSystems #GlobalCircle',
      location: 'Tokyo, Japan',
      country: 'Japan',
      language: 'Japanese',
      createdAt: '3 hours ago',
      likes: ['adrian', 'cherian'],
      reactions: { clap: ['adrian', 'cherian'] },
      reactionTracker: { userReactions: { adrian: 'clap', cherian: 'clap' }, switchCounts: {} },
      comments: [],
      sharesCount: 1,
      privacy: 'public',
      vibe: { kind: 'Creating', label: 'Grid Study #14' },
    },
    {
      id: 'post-chermaine-bagasbas',
      authorId: 'chermaine',
      content:
        'Golden hour rolled across Bagasbas Beach in under ten minutes. Shot two rolls on 35mm before heading back toward Labo. #BagasbasBeach #Daet #35mmFilm',
      location: 'Daet, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'English',
      createdAt: '4 hours ago',
      likes: ['adrian', 'cherian', 'faye'],
      reactions: { heart: ['adrian', 'cherian', 'faye'] },
      reactionTracker: { userReactions: { adrian: 'heart', cherian: 'heart', faye: 'heart' }, switchCounts: {} },
      comments: [],
      photoId: 'ph-sunrise',
      sharesCount: 3,
      privacy: 'friends_of_friends',
      vibe: { kind: 'At', label: 'Bagasbas Shoreline, Daet' },
    },
    {
      id: 'post-sofia-madrid',
      authorId: 'sofia',
      content:
        '¡Buenos días desde Madrid! Hoy probamos una nueva receta de brioche con fermentación lenta. ¿Alguien en Filipinas hace pan con masa madre y coco? #ArtisanBaking #BakersCircle',
      location: 'Madrid, Spain',
      country: 'Spain',
      language: 'Spanish',
      createdAt: '5 hours ago',
      likes: ['cherry', 'flaneth'],
      reactions: { heart: ['cherry', 'flaneth'] },
      reactionTracker: { userReactions: { cherry: 'heart', flaneth: 'heart' }, switchCounts: {} },
      comments: [],
      groupId: 'grp-bakers-exchange',
      sharesCount: 1,
      privacy: 'public',
    },
    {
      id: 'post-cherian-design',
      authorId: 'cherian',
      content:
        'Wrapping up packaging proofs and label hierarchy for local makers in Daet and Labo. Clean type makes every homemade box feel unforgettable. #DesignLab #Daet',
      location: 'Daet, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'English',
      createdAt: '6 hours ago',
      likes: ['adrian', 'batotten', 'kenji'],
      reactions: { clap: ['adrian', 'batotten', 'kenji'] },
      reactionTracker: { userReactions: { adrian: 'clap', batotten: 'clap', kenji: 'clap' }, switchCounts: {} },
      comments: [],
      photoId: 'ph-design',
      sharesCount: 2,
      privacy: 'public',
    },
    {
      id: 'post-faye-studio',
      authorId: 'faye',
      content:
        'Today in the studio: layering seafoam and sunlit ochre on an 18x24 coastal canvas. Thinking of opening Saturday morning sketching sessions for young artists in Labo! #LaboArtists #Painting',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'English',
      createdAt: 'Yesterday',
      likes: ['adrian', 'chermaine', 'minji'],
      reactions: { heart: ['adrian', 'minji'], fire: ['chermaine'] },
      reactionTracker: { userReactions: { adrian: 'heart', minji: 'heart', chermaine: 'fire' }, switchCounts: {} },
      comments: [],
      photoId: 'ph-studio',
      sharesCount: 4,
      privacy: 'public',
    },
    {
      id: 'post-adrian-private',
      authorId: 'adrian',
      content:
        'Private reflection note: Mapping out our year-end family calendar and weekend coastal drives around Camarines Norte. (Visible only to me in Vault)',
      location: 'Labo, Camarines Norte, Philippines',
      country: 'Philippines',
      language: 'English',
      createdAt: '2 days ago',
      likes: [],
      reactions: {},
      comments: [],
      sharesCount: 0,
      privacy: 'only_me',
      vibe: { kind: 'Reading', label: 'Personal Journal' },
    },
    // Pending tag example on Adrian so user can immediately test Tag Approval!
    {
      id: 'post-pending-tag-demo',
      authorId: 'batotten',
      taggedUserIds: ['adrian'],
      approvedTagUserIds: [],
      pendingTagUserIds: ['adrian'],
      content:
        'Throwback to our late-night design & coffee jam with @adriancanal! Wait lang, checking if you approve the tag before it shows on your MySpace.',
      location: 'Manila, Philippines',
      country: 'Philippines',
      language: 'English',
      createdAt: '3 hours ago',
      likes: ['cherian'],
      reactions: { laugh: ['cherian'] },
      reactionTracker: { userReactions: { cherian: 'laugh' }, switchCounts: {} },
      comments: [],
      sharesCount: 0,
      privacy: 'friends_only',
    },
    ...REALISTIC_PAGE_STARTER_POSTS,
  ];

  const testimonials: TestimonialItem[] = [
    {
      id: 'test-1',
      authorId: 'cherry',
      recipientId: 'adrian',
      quote: 'Adrian always shows up for local bakers and creators in Labo—hindi nakakalimot kahit busy.',
      createdAt: '2 days ago',
    },
    {
      id: 'test-2',
      authorId: 'faye',
      recipientId: 'adrian',
      quote: 'The kind of friend who connects artists, designers, and families together naturally.',
      createdAt: 'Last week',
    },
    {
      id: 'test-3',
      authorId: 'adrian',
      recipientId: 'cherry',
      quote: 'Best morning ensaymada and pandesal in Labo! Always warm and generous.',
      createdAt: '3 days ago',
    },
  ];

  const threads: MessageThread[] = [
    {
      id: 'thr-cherry',
      participantIds: ['adrian', 'cherry'],
      unreadCount: 1,
      messages: [
        {
          id: 'msg-1',
          senderId: 'cherry',
          text: 'Hey Adrian! Setting aside a warm box of cheesy ensaymada and sourdough for your merienda later.',
          timestamp: '10:12 AM',
          language: 'English',
          deliveredTo: ['adrian'],
          readBy: [],
        },
      ],
    },
    {
      id: 'thr-cherian',
      participantIds: ['adrian', 'cherian'],
      unreadCount: 0,
      messages: [
        {
          id: 'msg-2',
          senderId: 'adrian',
          text: 'Cherian, the packaging layout for Baked by Baby looks super crisp!',
          timestamp: 'Yesterday · 4:15 PM',
          language: 'English',
          deliveredTo: ['cherian'],
          readBy: ['cherian'],
        },
        {
          id: 'msg-3',
          senderId: 'cherian',
          text: 'Thank you! Sending the final print PDF later today.',
          timestamp: 'Yesterday · 4:20 PM',
          language: 'English',
          deliveredTo: ['adrian'],
          readBy: ['adrian'],
        },
      ],
    },
    {
      id: 'thr-kenji',
      participantIds: ['adrian', 'kenji'],
      unreadCount: 1,
      messages: [
        {
          id: 'msg-4',
          senderId: 'kenji',
          text: 'こんにちは、エイドリアン！フィリピンのカマリネス・ノルテの写真、とても素敵ですね。今度デザイン談義をしましょう。',
          timestamp: '09:30 AM',
          language: 'Japanese',
          deliveredTo: ['adrian'],
          readBy: [],
        },
      ],
    },
  ];

  const anonymousPosts: AnonymousPost[] = [
    {
      id: 'anon-1',
      topic: 'Community Concerns',
      alias: generateAnonymousAlias('anon-seed-1'),
      authorId: 'cherian',
      title: 'Keeping Maharlika Highway stops safe and clean during Busig-On week',
      content:
        'With more travelers passing through Labo for Busig-On Festival and pasalubong stops, having clearly lit pedestrian lanes near local food stalls would help both commuters and vendors.',
      createdAt: '2 hours ago',
      language: 'English',
      supportiveVotes: ['adrian', 'cherry', 'flaneth'],
      replies: [
        {
          id: 'ar-1',
          alias: generateAnonymousAlias('anon-reply-1'),
          authorId: 'adrian',
          text: 'Great point—community marshals and reflective cones near busy bakery corners really make a difference.',
          createdAt: '1 hour ago',
          language: 'English',
          supportiveVotes: ['cherian'],
        },
      ],
      reports: [],
    },
    {
      id: 'anon-2',
      topic: 'Advice & Mentorship',
      alias: generateAnonymousAlias('anon-seed-2'),
      authorId: 'faye',
      title: 'Pricing handmade art and craft fairly without undervaluing studio hours',
      content:
        'For fellow local artists and home bakers just starting out: how do you balance keeping prices accessible for neighbors while still covering materials and real craft time?',
      createdAt: 'Yesterday',
      language: 'English',
      supportiveVotes: ['adrian', 'cherry', 'batotten'],
      replies: [],
      reports: [],
    },
  ];

  const verificationRequests: SphereIdVerificationRequest[] = [
    {
      id: 'ver-1',
      applicantUserId: 'cnrelieforg',
      applicantName: 'Camarines Norte Relief & Aid Foundation',
      category: 'verified_organization',
      entityName: 'Camarines Norte Relief & Aid Foundation',
      country: 'Philippines',
      publicLink: 'https://cnrelief.org.ph/transparency',
      govAgency: 'DSWD Field Office V / SEC',
      govRegNumber: 'DSWD-FO5-2023-0142',
      notes: 'Registered provincial civic relief and school supply foundation.',
      documentSummary: {
        fileName: 'dswd_sec_certificate_2023.pdf',
        fileType: 'application/pdf',
        fileSizeBytes: 245120,
        sha256Short: '8f3a91c2d4017b2e',
      },
      status: 'approved',
      submittedAt: '2026-10-01',
      reviewedAt: '2026-10-02',
      reviewNote: 'Verified against DSWD Field Office V & SEC registry.',
    },
  ];

  const adCampaigns: AdCampaign[] = [
    {
      id: 'ad-bakedbybaby',
      advertiserId: 'flaneth',
      postId: 'post-bakedbybaby',
      title: 'Baked by Baby — Busig-On Week Cassava Cake Promo',
      objective: 'reach',
      destinationUrl: 'https://sphere.ph/shelves/mkt-cassava',
      targetCountries: ['Philippines'],
      targetLocations: ['Labo', 'Daet', 'Camarines Norte', 'Manila'],
      targetInterests: ['Local Food', 'Artisan Baking', 'Travel'],
      targetAgeMin: 18,
      targetAgeMax: 65,
      dailyBudgetPhp: 350,
      durationDays: 7,
      estimatedReachMin: 1400,
      estimatedReachMax: 3200,
      status: 'approved',
      billingStatus: 'awaiting_payment_setup',
      moderationNote: 'Approved local food enterprise promo.',
      impressions: 12,
      uniqueViewerIds: ['cherry', 'cherian'],
      clicks: 3,
      engagements: 4,
      createdAt: '2026-11-14',
      updatedAt: '2026-11-14',
    },
  ];

  const donationDrives: DonationDrive[] = [
    {
      id: 'drive-labo-schoolkits',
      organizerId: 'cnrelieforg',
      organizerName: 'Camarines Norte Relief & Aid Foundation',
      govAgency: 'DSWD Field Office V / SEC',
      govRegNumber: 'DSWD-FO5-2023-0142',
      title: 'Labo & Daet Flood-Resilient School Kits Drive',
      description:
        'Providing waterproof backpacks, notebooks, raincoats, and art supplies for 250 public elementary learners across upland barangays in Labo and Daet. Every pledge is logged transparently on the public ledger.',
      location: 'Labo & Daet, Camarines Norte',
      category: 'Education & Youth',
      goalAmountPhp: 75000,
      raisedAmountPhp: 28500,
      coverImage: '/media-seed/sphere_hero_community_1794746490268.jpg',
      verifiedGov: true,
      status: 'active',
      pledges: [
        {
          id: 'plg-1',
          donorId: 'adrian',
          donorName: 'Adrian Canal Villanueva',
          amountPhp: 2500,
          note: 'For our upland elementary learners in Labo!',
          createdAt: 'Yesterday',
        },
        {
          id: 'plg-2',
          donorId: 'cherry',
          donorName: 'Cherry Celestial',
          amountPhp: 1500,
          note: 'From Balai Panaderia weekend bake proceeds.',
          createdAt: '2 days ago',
        },
      ],
      createdAt: '2026-11-05',
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      recipientId: 'adrian',
      actorId: 'batotten',
      type: 'tag_request',
      text: 'Batotten Canal tagged you in a post. Review before it appears on your MySpace.',
      postId: 'post-pending-tag-demo',
      read: false,
      createdAt: '3 hours ago',
    },
    {
      id: 'notif-2',
      recipientId: 'adrian',
      actorId: 'sofia',
      type: 'friend_request',
      text: 'Sofia Morales (Madrid, Spain) sent you a circle connection request.',
      read: false,
      createdAt: '5 hours ago',
    },
  ];

  const db: SphereDatabase = {
    users,
    friendships,
    outgoingRequests: { sofia: ['adrian'] },
    posts,
    photos,
    albums,
    marketplace,
    groups,
    pages,
    testimonials,
    threads,
    anonymousPosts,
    verificationRequests,
    adCampaigns,
    donationDrives,
    notifications,
    shareRecords: [],
    blockedUsers: {},
  };

  for (let i = 0; i < db.users.length; i += 1) {
    enrichUserLifeDetails(db.users[i], i);
  }
  const featuredActivityIds = [
    'cherry', 'chermaine', 'cherian', 'flaneth', 'batotten', 'faye', 'sofia', 'kenji', 'minji',
    'marco-tech', 'clarisse-sw', 'paolo-moto', 'harley-arts', 'mateo-agri',
    'imf-liam-vance', 'imf-kim-min-jun', 'imf-somchai-srisai', 'imf-juan-dela-cruz', 'imf-peter-parker',
  ];
  for (const fid of featuredActivityIds) {
    ensureFriendLifeActivity(db, fid);
  }

  return db;
}

export function migrateSeedData(db: SphereDatabase): boolean {
  let dirty = false;

  // 1. Ensure Adrian has the runtime admin email & avatar
  const adrian = db.users.find((u) => u.id === 'adrian');
  if (adrian) {
    if (adrian.email !== 'adrrycanal@gmail.com') {
      adrian.email = 'adrrycanal@gmail.com';
      adrian.role = 'admin';
      dirty = true;
    }
    if (!adrian.avatar) {
      adrian.avatar = '/assets/aistudio/image_a7c7256c.png';
      dirty = true;
    }
  }

  // 2. Ensure realistic community users exist
  for (const ru of REALISTIC_COMMUNITY_USERS) {
    if (!db.users.some((u) => u.id === ru.id)) {
      db.users.push(ru);
      db.friendships[ru.id] = db.friendships[ru.id] || ['adrian'];
      db.friendships.adrian = Array.from(new Set([...(db.friendships.adrian || []), ru.id]));
      dirty = true;
    }
  }

  // 2b. Ensure all imaginary friend accounts exist & are connected to Adrian
  const existingUserIds = new Set(db.users.map((u) => u.id));
  const adrianFriendList = (db.friendships.adrian ||= []);
  const adrianFriendSet = new Set(adrianFriendList);
  for (const imf of IMAGINARY_FRIEND_USERS) {
    if (!existingUserIds.has(imf.id)) {
      db.users.push(imf);
      existingUserIds.add(imf.id);
      dirty = true;
    }
    const targetList = (db.friendships[imf.id] ||= []);
    if (!targetList.includes('adrian')) {
      targetList.push('adrian');
      dirty = true;
    }
    if (!adrianFriendSet.has(imf.id)) {
      adrianFriendList.push(imf.id);
      adrianFriendSet.add(imf.id);
      dirty = true;
    }
  }
  if (adrian && adrian.friendCount !== adrianFriendList.length) {
    adrian.friendCount = adrianFriendList.length;
    dirty = true;
  }

  // 3. Upgrade Municipality of Labo & Baked by Baby pages with official seal/logo, facts & rules
  const laboPage = db.pages.find((p) => p.id === 'page-labo-lgu');
  if (laboPage && laboPage.avatar !== LABO_PAGE_OVERRIDES.avatar) {
    Object.assign(laboPage, LABO_PAGE_OVERRIDES);
    dirty = true;
  }
  const bakedPage = db.pages.find((p) => p.id === 'page-bakedbybaby');
  if (bakedPage && bakedPage.avatar !== BAKED_BY_BABY_OVERRIDES.avatar) {
    Object.assign(bakedPage, BAKED_BY_BABY_OVERRIDES);
    dirty = true;
  }

  // 4. Add Adrian's 100 functional pages if not present yet
  const adrianPages = createAdrian100Pages();
  const existingPageIds = new Set(db.pages.map((p) => p.id));
  for (const ap of adrianPages) {
    if (!existingPageIds.has(ap.id)) {
      db.pages.push(ap);
      dirty = true;
    }
  }

  // 5. Backfill domain-accurate rules/guidelines onto every Page
  for (const page of db.pages) {
    if (!page.rules || page.rules.length === 0 || !page.postingPolicy) {
      const preset = getCategoryGuidelines(page.category);
      page.rules = page.rules && page.rules.length > 0 ? page.rules : preset.rules;
      page.postingPolicy = page.postingPolicy || preset.postingPolicy;
      page.guidelinesSummary = page.guidelinesSummary || preset.guidelinesSummary;
      dirty = true;
    }
  }

  // 6. Add extra realistic Circles if missing & backfill rules on every Circle
  const existingGroupIds = new Set(db.groups.map((g) => g.id));
  const coreGroupIds = [
    'grp-labo-makers',
    'grp-bakers-exchange',
    'grp-design-sketch',
    'grp-hardware-builders',
    'grp-labo-social-works',
    'grp-bicol-safe-riders',
  ];
  if (coreGroupIds.some((gid) => !existingGroupIds.has(gid))) {
    const seed = createInitialSeed();
    for (const sg of seed.groups) {
      if (!existingGroupIds.has(sg.id)) {
        db.groups.push(sg);
        dirty = true;
      }
    }
  }
  for (const grp of db.groups) {
    if (!grp.rules || grp.rules.length === 0 || !grp.postingPolicy) {
      const preset = getCategoryGuidelines(grp.category, true);
      grp.rules = grp.rules && grp.rules.length > 0 ? grp.rules : preset.rules;
      grp.postingPolicy = grp.postingPolicy || preset.postingPolicy;
      grp.guidelinesSummary = grp.guidelinesSummary || preset.guidelinesSummary;
      dirty = true;
    }
  }

  // 7. Add realistic starter Page posts if missing
  const existingPostIds = new Set(db.posts.map((p) => p.id));
  for (const rp of REALISTIC_PAGE_STARTER_POSTS) {
    if (!existingPostIds.has(rp.id)) {
      db.posts.push(rp);
      dirty = true;
    }
  }

  // 8. Enrich every user account with full real-life details (career, education, hometown, relationship, hobbies)
  for (let i = 0; i < db.users.length; i += 1) {
    if (enrichUserLifeDetails(db.users[i], i)) {
      dirty = true;
    }
  }

  // 9. Ensure core & featured friends have starter life posts, photos & testimonials
  const featuredActivityIds = [
    'cherry', 'chermaine', 'cherian', 'flaneth', 'batotten', 'faye', 'sofia', 'kenji', 'minji',
    'marco-tech', 'clarisse-sw', 'paolo-moto', 'harley-arts', 'mateo-agri',
    'imf-liam-vance', 'imf-kim-min-jun', 'imf-somchai-srisai', 'imf-juan-dela-cruz', 'imf-peter-parker',
  ];
  for (const fid of featuredActivityIds) {
    if (ensureFriendLifeActivity(db, fid).changed) {
      dirty = true;
    }
  }

  if (!Array.isArray(db.shareRecords)) {
    db.shareRecords = [];
    dirty = true;
  }
  if (!db.blockedUsers || typeof db.blockedUsers !== 'object') {
    db.blockedUsers = {};
    dirty = true;
  }

  return dirty;
}

export function sanitizeUser(user: UserProfile, viewerId?: string, db?: SphereDatabase): UserProfile {
  const { password: _removed, ...rest } = user;
  if (!viewerId || !db || viewerId === user.id) {
    return {
      ...rest,
      friendship: 'none',
      ...(viewerId === user.id && db
        ? {
            securityRoles: resolveUserSecurityRoles(user),
            blockedUserIds: [...(db.blockedUsers?.[user.id] || [])],
          }
        : viewerId === user.id
          ? { securityRoles: resolveUserSecurityRoles(user) }
          : {}),
    };
  }
  const viewerFriends = new Set(db.friendships[viewerId] || []);
  const viewerOutgoing = new Set(db.outgoingRequests[viewerId] || []);
  const targetOutgoing = new Set(db.outgoingRequests[user.id] || []);

  let friendship: UserProfile['friendship'] = 'none';
  if (viewerFriends.has(user.id)) friendship = 'friends';
  else if (viewerOutgoing.has(user.id)) friendship = 'requested_outgoing';
  else if (targetOutgoing.has(viewerId)) friendship = 'requested_incoming';

  const targetFriends = new Set(db.friendships[user.id] || []);
  let mutualFriends = 0;
  for (const fid of viewerFriends) {
    if (targetFriends.has(fid)) mutualFriends += 1;
  }

  return {
    ...rest,
    friendship,
    mutualFriends,
    friendCount: targetFriends.size,
  };
}

export function sanitizeUsersForViewer(
  db: SphereDatabase,
  viewerId?: string,
  precomputedFriendships?: Record<string, Set<string>>
): UserProfile[] {
  if (!viewerId) {
    return db.users.map((u) => {
      const { password: _removed, ...rest } = u;
      return { ...rest, friendship: 'none' };
    });
  }

  const viewerFriends =
    precomputedFriendships?.[viewerId] || new Set(db.friendships[viewerId] || []);
  const viewerOutgoing = new Set(db.outgoingRequests[viewerId] || []);

  return db.users.map((user) => {
    const { password: _removed, ...rest } = user;
    if (viewerId === user.id) {
      return {
        ...rest,
        friendship: 'none',
        friendCount: viewerFriends.size,
        securityRoles: resolveUserSecurityRoles(user),
        blockedUserIds: [...(db.blockedUsers?.[user.id] || [])],
      };
    }

    const targetFriends =
      precomputedFriendships?.[user.id] || new Set(db.friendships[user.id] || []);
    const targetOutgoing = db.outgoingRequests[user.id] || [];

    let friendship: UserProfile['friendship'] = 'none';
    if (viewerFriends.has(user.id)) friendship = 'friends';
    else if (viewerOutgoing.has(user.id)) friendship = 'requested_outgoing';
    else if (targetOutgoing.includes(viewerId)) friendship = 'requested_incoming';

    let mutualFriends = 0;
    if (targetFriends.size <= viewerFriends.size) {
      for (const fid of targetFriends) {
        if (viewerFriends.has(fid)) mutualFriends += 1;
      }
    } else {
      for (const fid of viewerFriends) {
        if (targetFriends.has(fid)) mutualFriends += 1;
      }
    }

    return {
      ...rest,
      friendship,
      mutualFriends,
      friendCount: targetFriends.size,
    };
  });
}
