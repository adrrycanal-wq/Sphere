import {
  AlbumItem,
  PhotoItem,
  PostComment,
  ReactionType,
  SocialPost,
  TestimonialItem,
  UserProfile,
} from '../src/types/social';
import type { SphereDatabase } from './seedData';

function hashStr(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

const PERSON_CAREERS = [
  { occupation: 'Senior Product Designer', workplace: 'Northstar Digital Studio', hobby: 'Film Photography', music: 'Indie Lo-Fi & City Pop', food: 'Pour-over coffee & warm croissants' },
  { occupation: 'Full-Stack Software Engineer', workplace: 'Clearline Systems', hobby: 'Mechanical Keyboards', music: 'Synthwave & Acoustic Covers', food: 'Spicy ramen & iced matcha' },
  { occupation: 'Community Pharmacist', workplace: 'Metro Care Apothecary', hobby: 'Urban Gardening', music: '90s R&B & Neo-Soul', food: 'Homemade pesto pasta & lemon tart' },
  { occupation: 'Architectural Drafter', workplace: 'Atelier Forma Studio', hobby: 'Watercolor Sketching', music: 'Bossa Nova & Jazz Trios', food: 'Grilled seafood & mango sticky rice' },
  { occupation: 'High School Literature Teacher', workplace: 'St. Clair Regional Academy', hobby: 'Book Collecting', music: 'Folk Indie & Piano Ballads', food: 'Earl grey tea & cinnamon toast' },
  { occupation: 'Pastry Chef & Cafe Manager', workplace: 'Cornerstone Bakehouse', hobby: 'Sourdough Fermentation', music: 'Morning Acoustic Radio', food: 'Brioche ensaymada & barako espresso' },
  { occupation: 'Civil & Structural Engineer', workplace: 'Bayview Infrastructure Group', hobby: 'Weekend Cycling', music: 'Classic Rock & Roadtrip Anthems', food: 'Garlic fried rice & grilled chicken' },
  { occupation: 'Pediatric Nurse', workplace: 'Mercy Community Hospital', hobby: 'Journaling & Calligraphy', music: 'Soft Pop & Chillhop', food: 'Hot arroz caldo & fresh fruit' },
  { occupation: 'Independent Documentary Filmmaker', workplace: 'Frame & Street Collective', hobby: '35mm Street Shooting', music: 'Ambient Soundtracks', food: 'Street tacos & cold brew' },
  { occupation: 'Specialty Coffee Roaster', workplace: 'Roastcraft Cooperative', hobby: 'Origin Cupping', music: 'Vinyl Soul & Funk', food: 'Single-origin espresso & banana bread' },
  { occupation: 'Motorcycle Mechanic & Custom Builder', workplace: 'Two-Wheel Garage', hobby: 'Dawn Mountain Rides', music: 'Alternative Rock', food: 'Beef pares & iced calamansi' },
  { occupation: 'Visual Illustrator & Muralist', workplace: 'Sunlit Loft Studio', hobby: 'Oil Pastels & Zines', music: 'Dream Pop & Bedroom Indie', food: 'Matcha latte & strawberry shortcake' },
];

const FILIPINO_CAREERS = [
  { occupation: 'IT Systems Specialist', workplace: 'Bicol Tech Solutions', hobby: 'PC Building & Retro Gaming', music: 'OPM Indie & Ben&Ben', food: 'Sinigang na baboy & halo-halo' },
  { occupation: 'Registered Nurse', workplace: 'Camarines Norte Provincial Hospital', hobby: 'Weekend Beach Trips', music: '90s OPM Acoustic', food: 'Laing, Bicol Express & cassava cake' },
  { occupation: 'Public School Educator', workplace: 'Labo Central School Cluster', hobby: 'Community Reading Drives', music: 'Classical Guitar & OPM', food: 'Hot pandesal with kesong puti' },
  { occupation: 'Local Cafe & Pasalubong Owner', workplace: 'Maharlika Roadside Treats', hobby: 'Recipe Testing', music: 'Morning FM & Acoustic', food: 'Tinapa fried rice & kapeng barako' },
  { occupation: 'Freelance Graphic Artist', workplace: 'Daet Creative Hub', hobby: 'Digital Painting & Posters', music: 'Lo-Fi Beats & SB19/Bini', food: 'Chicken inasal & mango shake' },
  { occupation: 'Civil Engineer', workplace: 'Pacific Coast Builders PH', hobby: 'Motorcycle Touring', music: 'Eraserheads & Parokya', food: 'Crispy pata & calamansi juice' },
];

const UNIVERSITIES_BY_COUNTRY: Record<string, string[]> = {
  Philippines: [
    'University of the Philippines Diliman',
    'Ateneo de Naga University',
    'Bicol University',
    'University of Santo Tomas',
    'University of San Carlos (Cebu)',
    'Camarines Norte State College',
  ],
  'South Korea': [
    'Seoul National University',
    'Yonsei University',
    'Korea University',
    'Pusan National University',
    'Hongik University School of Fine Arts',
  ],
  Thailand: [
    'Chulalongkorn University',
    'Thammasat University',
    'Chiang Mai University',
    'Mahidol University',
  ],
  China: [
    'Fudan University',
    'Zhejiang University',
    'Tsinghua University',
    'Peking University',
  ],
  'United Kingdom': [
    'University of Manchester',
    'University of Edinburgh',
    'University of Bristol',
    'University College London',
  ],
  Canada: [
    'University of Toronto',
    'McGill University',
    'University of British Columbia',
    'University of Ottawa',
  ],
  Singapore: [
    'National University of Singapore',
    'Nanyang Technological University',
    'Singapore Management University',
  ],
  'United States': [
    'University of Texas at Austin',
    'University of Washington',
    'New York University',
    'University of California, Berkeley',
  ],
  Japan: [
    'University of Tokyo',
    'Kyoto University',
    'Waseda University',
    'Hokkaido University',
  ],
  Italy: [
    'Politecnico di Milano',
    'University of Bologna',
    'Sapienza University of Rome',
  ],
  Australia: [
    'University of Melbourne',
    'University of Sydney',
    'Victoria University of Wellington',
  ],
};

const RELATIONSHIP_STATUSES = [
  'Single',
  'In a relationship',
  'Married',
  'Single · Focused on personal projects',
  'Engaged',
  'Happy & grateful',
];

const ACTIVE_LABELS = [
  'Active 8m ago · Replying to friends',
  'Active 22m ago · Browsing Pulse',
  'Active 1h ago · Uploaded a life update',
  'Active today · Sharing weekend plans',
  'Active 35m ago · Listening to music',
];

const SEED_PHOTOS = [
  '/media-seed/bagasbas_sunrise_daet_1794746488854.jpg',
  '/media-seed/sphere_hero_community_1794746490268.jpg',
  '/media-seed/designer_studio_desk_1794746490487.jpg',
  '/media-seed/artist_painting_studio_1794746490153.jpg',
  '/media-seed/artisan_bakery_table_1794746488917.jpg',
  '/media-seed/labo_busigon_festival_1794746488196.jpg',
  '/media-seed/cassava_cake_labo_1794746488921.jpg',
];

type Archetype = 'filipino' | 'global_person' | 'creative' | 'hero' | 'leader' | 'brand' | 'org';

function detectArchetype(user: UserProfile): Archetype {
  const bio = (user.bio || '').toLowerCase();
  const status = (user.status || '').toLowerCase();
  if (user.sphereIdCategory === 'verified_organization') {
    if (bio.includes('brand') || status.includes('products')) return 'brand';
    return 'org';
  }
  if (bio.includes('public leadership') || bio.includes('historical civic')) return 'leader';
  if (bio.includes('storybook') || bio.includes('pop-culture')) return 'hero';
  if (bio.includes('worldbuilding') || bio.includes('visual storyteller')) return 'creative';
  if (user.country === 'Philippines') return 'filipino';
  return 'global_person';
}

export function enrichUserLifeDetails(user: UserProfile, indexHint = 0): boolean {
  if (user.id === 'adrian') {
    let changed = false;
    if (!user.occupation) {
      user.occupation = 'Founder & Community Architect';
      changed = true;
    }
    if (!user.workplace) {
      user.workplace = 'Sphere. Community Platform · Labo';
      changed = true;
    }
    if (!user.education) {
      user.education = 'B.S. Information Technology · Camarines Norte';
      changed = true;
    }
    if (!user.hometown) {
      user.hometown = 'Labo, Camarines Norte, Philippines';
      changed = true;
    }
    if (!user.relationshipStatus) {
      user.relationshipStatus = 'Family-first · Proud father';
      changed = true;
    }
    if (!user.currentlyInto) {
      user.currentlyInto = 'Roasting local coffee & building community spaces';
      changed = true;
    }
    if (!user.favoriteFood) {
      user.favoriteFood = 'Baked by Baby Cassava Cake & fresh pandesal';
      changed = true;
    }
    if (!user.activeStatusLabel) {
      user.activeStatusLabel = 'Active now';
      changed = true;
    }
    return changed;
  }

  if (
    user.occupation &&
    user.workplace &&
    user.education &&
    user.hometown &&
    user.relationshipStatus &&
    user.activeStatusLabel
  ) {
    return false;
  }

  const seed = hashStr(`${user.id}:${user.name}`) + indexHint;
  const archetype = detectArchetype(user);
  const cityOnly = (user.location || 'Manila').split(',')[0].trim();

  if (archetype === 'org') {
    user.occupation ||= user.name.includes('Department')
      ? 'Philippine National Public Service Agency'
      : 'International Civic & Humanitarian Organization';
    user.workplace ||= `${user.name} Official Desk · ${cityOnly}`;
    user.education ||= 'Verified Public Charter & Civic Mandate';
    user.hometown ||= user.location;
    user.relationshipStatus ||= 'Official Verified Institution';
    user.currentlyInto ||= 'Coordinating community outreach, advisories & volunteer support';
    user.favoriteFood ||= 'Field relief volunteer coffee';
    user.activeStatusLabel ||= 'Official Page · Daily public updates';
    return true;
  }

  if (archetype === 'brand') {
    user.occupation ||= 'Official Global Brand & Creator Partner';
    user.workplace ||= `${user.name} Flagship Community Hub`;
    user.education ||= `Founded for Design, Craft & Everyday Utility`;
    user.hometown ||= user.location;
    user.relationshipStatus ||= 'Verified Global Brand';
    user.currentlyInto ||= `Sharing product milestones & customer stories in ${cityOnly}`;
    user.favoriteFood ||= user.name === 'Jollibee' ? 'Crispy Chickenjoy & Peach Mango Pie' : 'Studio espresso';
    user.activeStatusLabel ||= 'Active today · Community showcase live';
    return true;
  }

  if (archetype === 'leader') {
    user.occupation ||= 'Statesperson & Public Policy Advocate';
    user.workplace ||= `Civic Leadership Forum · ${cityOnly}`;
    user.education ||= 'School of Law, Economics & Public Governance';
    user.hometown ||= user.location;
    user.relationshipStatus ||= 'Dedicated to public service';
    user.currentlyInto ||= 'Reading constitutional history & listening to townhall questions';
    user.favoriteFood ||= 'Classic black coffee & local home cooking';
    user.activeStatusLabel ||= 'Active today · Sharing civic reflections';
    return true;
  }

  if (archetype === 'hero') {
    user.occupation ||= user.name.includes('Parker')
      ? 'Photojournalist & Neighborhood Hero'
      : user.name.includes('Kent')
        ? 'Investigative Reporter'
        : user.name.includes('Stark')
          ? 'Clean-Tech Inventor & Engineer'
          : user.name.includes('Mouse') || user.name.includes('Duck')
            ? 'Clubhouse Host & Adventure Captain'
            : 'Storybook Explorer & Protector';
    user.workplace ||= user.name.includes('Parker') ? 'Daily Bugle Photo Desk · NYC' : `Storybook Collective · ${cityOnly}`;
    user.education ||= 'Empire State & Classic Storybook Academy';
    user.hometown ||= user.location;
    user.relationshipStatus ||= pick(['In a classic storybook romance', 'Always looking out for friends', 'Ready for the next adventure'], seed);
    user.currentlyInto ||= 'Swinging by friends’ feeds & sketching adventure logs';
    user.favoriteFood ||= user.name.includes('Mouse') ? 'Warm waffles & cocoa' : 'NYC street pizza & iced coffee';
    user.activeStatusLabel ||= 'Active 15m ago · Hanging out in Sphere.';
    return true;
  }

  if (archetype === 'creative') {
    const roles = [
      'Concept Artist & Novel Writer',
      'Indie Game Lore Designer',
      'Moonlit Analog Photographer',
      'Soundscape Composer & Illustrator',
      'Fantasy Cartographer & Printmaker',
    ];
    user.occupation ||= pick(roles, seed);
    user.workplace ||= `${cityOnly} Midnight Atelier`;
    user.education ||= 'Academy of Fine Arts & Comparative Literature';
    user.hometown ||= user.location;
    user.relationshipStatus ||= pick(['Single', 'In a creative partnership', 'Married to the sketchbook'], seed);
    user.currentlyInto ||= 'Drafting chapter outlines & listening to orchestral soundtracks';
    user.favoriteFood ||= 'Dark roast coffee, dark chocolate & warm soup';
    user.activeStatusLabel ||= 'Active 19m ago · Posting studio WIPs';
    return true;
  }

  const careerPool = archetype === 'filipino' ? FILIPINO_CAREERS : PERSON_CAREERS;
  const career = pick(careerPool, seed);
  const countrySchools = UNIVERSITIES_BY_COUNTRY[user.country || ''] || UNIVERSITIES_BY_COUNTRY['United States'];

  user.occupation ||= career.occupation;
  user.workplace ||= `${career.workplace} (${cityOnly})`;
  user.education ||= pick(countrySchools, seed, 3);
  user.hometown ||= user.location;
  user.relationshipStatus ||= pick(RELATIONSHIP_STATUSES, seed, 5);
  user.currentlyInto ||= `${career.hobby} · Listening to ${career.music}`;
  user.favoriteFood ||= career.food;
  user.activeStatusLabel ||= pick(ACTIVE_LABELS, seed, 2);

  // Give unique flavor to personal status/bio/quote if still generic
  if (!user.bio || user.bio.includes('active community member & friend on Sphere.')) {
    const first = user.name.split(' ')[0];
    user.bio = `${career.occupation} at ${career.workplace} in ${user.location}. Studied at ${user.education}. Big fan of ${career.hobby.toLowerCase()}, ${career.food.toLowerCase()}, and keeping in touch with friends on Sphere.`;
    user.status = `Off the clock in ${cityOnly} — enjoying ${career.food.toLowerCase()} & catching up on ${career.hobby.toLowerCase()}!`;
    user.quote = `${first}'s rule: make time for good people, honest work, and a quiet evening walk.`;
    if (user.interests.length <= 5 && !user.interests.includes(career.hobby)) {
      user.interests = Array.from(new Set([career.hobby, ...user.interests])).slice(0, 6);
    }
  }

  return true;
}

function pickPeerCommenters(db: SphereDatabase, targetUser: UserProfile, seed: number): UserProfile[] {
  const candidates = db.users.filter(
    (u) =>
      u.id !== targetUser.id &&
      u.id !== 'adrian' &&
      (u.country === targetUser.country || u.id === 'cherry' || u.id === 'chermaine' || u.id === 'cherian' || u.id === 'faye')
  );
  const pool = candidates.length >= 3 ? candidates : db.users.filter((u) => u.id !== targetUser.id);
  const p1 = pool[seed % pool.length];
  const p2 = pool[(seed + 7) % pool.length];
  const p3 = pool[(seed + 13) % pool.length];
  return [p1, p2, p3].filter((x, i, arr): x is UserProfile => Boolean(x) && arr.findIndex((y) => y?.id === x?.id) === i);
}

function buildReactionMap(reactors: UserProfile[], types: ReactionType[]) {
  const reactions: Partial<Record<ReactionType, string[]>> = {};
  const userReactions: Record<string, ReactionType> = {};
  const likes: string[] = [];

  reactors.forEach((r, idx) => {
    const rt = types[idx % types.length];
    likes.push(r.id);
    userReactions[r.id] = rt;
    reactions[rt] = [...(reactions[rt] || []), r.id];
  });

  return {
    likes,
    reactions,
    reactionTracker: { userReactions, switchCounts: {} },
  };
}

export function ensureFriendLifeActivity(
  db: SphereDatabase,
  userId: string
): {
  changed: boolean;
  posts: SocialPost[];
  photos: PhotoItem[];
  albums: AlbumItem[];
  testimonials: TestimonialItem[];
} {
  let changed = false;
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return { changed: false, posts: [], photos: [], albums: [], testimonials: [] };
  }

  if (enrichUserLifeDetails(user)) {
    changed = true;
  }

  const existingOwnedPosts = db.posts.filter(
    (p) => p.authorId === user.id && !p.postAsPage
  );
  const seed = hashStr(`${user.id}:${user.name}`);
  const first = user.name.split(' ')[0];
  const city = (user.location || 'Sphere City').split(',')[0].trim();
  const archetype = detectArchetype(user);
  const peers = pickPeerCommenters(db, user, seed);
  const c1 = peers[0] || db.users[0];
  const c2 = peers[1] || db.users[1] || peers[0];
  const c3 = peers[2] || db.users[0];

  const photoA = SEED_PHOTOS[seed % SEED_PHOTOS.length];
  const photoB = SEED_PHOTOS[(seed + 3) % SEED_PHOTOS.length];

  // Ensure an album + 2 photos exist for this friend
  const albumId = `life-album-${user.id}`;
  const photo1Id = `life-photo-${user.id}-1`;
  const photo2Id = `life-photo-${user.id}-2`;
  if (!db.albums.some((a) => a.id === albumId || a.ownerId === user.id)) {
    db.albums.push({
      id: albumId,
      ownerId: user.id,
      name: `${first}'s Everyday Moments`,
      description: `Photos, studio snapshots, and weekend memories shared by ${user.name} in ${city}.`,
      privacy: 'public',
      coverPhotoId: photo1Id,
      coverSrc: photoA,
      createdAt: '2 weeks ago',
      updatedAt: 'Yesterday',
    });
    changed = true;
  }

  const existingOwnedPhotos = db.photos.filter((ph) => ph.ownerId === user.id && !ph.postAsPage);

  if (existingOwnedPhotos.length === 0) {
    const r1 = buildReactionMap([c1, c2, c3], ['heart', 'fire', 'clap']);
    const r2 = buildReactionMap([c2, c1], ['heart', 'clap']);

    db.photos.push(
      {
        id: photo1Id,
        ownerId: user.id,
        albumId,
        src: photoA,
        caption:
          archetype === 'brand'
            ? `${user.name} studio highlight — grateful for everyone sharing stories with us from ${city}!`
            : archetype === 'org'
              ? `${user.name} community outreach & coordination team check-in at ${city}.`
              : `Quiet afternoon break around ${city} after wrapping up work at ${user.workplace}.`,
        location: user.location,
        album: `${first}'s Everyday Moments`,
        createdAt: 'Yesterday',
        likes: r1.likes,
        reactions: r1.reactions,
        reactionTracker: r1.reactionTracker,
        comments: [
          {
            id: `lphc-${user.id}-1`,
            authorId: c1.id,
            text: `Ganda ng kuha mo rito, ${first}! Hope you're having a solid week.`,
            createdAt: '18 hours ago',
            likes: 2,
          },
        ],
        privacy: 'public',
      },
      {
        id: photo2Id,
        ownerId: user.id,
        albumId,
        src: photoB,
        caption: `Weekend energy: ${(user.hobbies && user.hobbies[0]) || 'sketching & coffee'} before the sunset.`,
        location: user.location,
        album: `${first}'s Everyday Moments`,
        createdAt: '4 days ago',
        likes: r2.likes,
        reactions: r2.reactions,
        reactionTracker: r2.reactionTracker,
        comments: [],
        privacy: 'public',
      }
    );
    user.photoCount = Math.max(user.photoCount || 0, 2);
    changed = true;
  }

  const resolvedPhoto1Id = db.photos.find((ph) => ph.ownerId === user.id && !ph.postAsPage)?.id || photo1Id;
  const resolvedPhoto2Id =
    db.photos.filter((ph) => ph.ownerId === user.id && !ph.postAsPage)[1]?.id || photo2Id;

  // Materialize rich life posts if this user has fewer than 3 authored timeline posts
  if (existingOwnedPosts.length < 3) {
    const templates: Array<{
      suffix: string;
      createdAt: string;
      content: string;
      vibe: SocialPost['vibe'];
      photoId?: string;
      comments: PostComment[];
      types: ReactionType[];
    }> = [];

    if (archetype === 'filipino') {
      templates.push(
        {
          suffix: '1',
          createdAt: `${(seed % 45) + 12} mins ago`,
          content: `Katatapos lang ng shift bilang ${user.occupation} dito sa ${city}! Deserve talaga ng ${user.favoriteFood?.toLowerCase()} ngayong hapon. Kumusta ang araw niyo diyan, mga kaibigan? #DailyLife #SpherePH`,
          vibe: { kind: 'At', label: `${city} · Merienda Break` },
          comments: [
            {
              id: `lc-${user.id}-1a`,
              authorId: c1.id,
              text: `Solid yan ${first}! Pahinga rin pag may time, see you soon!`,
              createdAt: '9 mins ago',
              likes: 2,
            },
            {
              id: `lc-${user.id}-1b`,
              authorId: c2.id,
              text: `Ingat lagi sa byahe diyan sa ${city}!`,
              createdAt: '4 mins ago',
              likes: 1,
            },
          ],
          types: ['heart', 'fire', 'clap'],
        },
        {
          suffix: '2',
          createdAt: 'Yesterday at 5:35 PM',
          content: `Quick throwback at afternoon reset bago mag-weekend. Sobrang nakakagaan ng loob kapag nakakahanap ng oras para sa ${user.hobbies?.[0] || 'craft'} at kwentuhan kasama ang circle. #WeekendVibes #${city.replace(/\s+/g, '')}`,
          vibe: { kind: 'Creating', label: user.hobbies?.[0] || 'Life Memories' },
          photoId: resolvedPhoto1Id,
          comments: [
            {
              id: `lc-${user.id}-2a`,
              authorId: c3.id,
              text: `Love this update! Tara kape minsan kapag free schedule mo.`,
              createdAt: '19 hours ago',
              likes: 3,
            },
          ],
          types: ['heart', 'clap', 'heart'],
        },
        {
          suffix: '3',
          createdAt: '4 days ago',
          content: `Grateful for small wins lately—finished a project sa ${user.workplace} at nakabawi rin sa tulog. Remind lang sa sarili: slow progress is still real progress. 🙌 #LifeNotes #Grateful`,
          vibe: { kind: 'Listening', label: user.currentlyInto || 'OPM Acoustic' },
          photoId: resolvedPhoto2Id,
          comments: [],
          types: ['clap', 'heart', 'fire'],
        }
      );
    } else if (archetype === 'org') {
      templates.push(
        {
          suffix: '1',
          createdAt: '35 mins ago',
          content: `Public Advisory & Community Update from ${user.name} (${city}): Field desks and citizen support hotlines remain open all week. Feel free to message our team or drop questions below for verified guidance. #PublicService #CommunityCare`,
          vibe: { kind: 'At', label: `${user.name} HQ` },
          comments: [
            {
              id: `lc-${user.id}-1a`,
              authorId: c1.id,
              text: `Thank you for keeping public updates accessible and clear here on Sphere.!`,
              createdAt: '18 mins ago',
              likes: 4,
            },
          ],
          types: ['clap', 'heart', 'clap'],
        },
        {
          suffix: '2',
          createdAt: 'Yesterday',
          content: `Highlights from our recent community coordination & preparedness workshop in ${user.location}. Huge gratitude to the local volunteers and educators who showed up early! #VolunteerSpirit`,
          vibe: { kind: 'At', label: user.location },
          photoId: resolvedPhoto1Id,
          comments: [],
          types: ['heart', 'clap', 'fire'],
        },
        {
          suffix: '3',
          createdAt: '5 days ago',
          content: `Reminder to double-check verified community bulletins before sharing announcements. Together we keep neighborhoods informed and resilient. #VerifiedInfo`,
          vibe: { kind: 'Reading', label: 'Annual Community Impact Report' },
          comments: [],
          types: ['clap', 'heart'],
        }
      );
    } else if (archetype === 'brand') {
      templates.push(
        {
          suffix: '1',
          createdAt: '42 mins ago',
          content: `Good morning from ${user.name}! Our team in ${city} is testing new community favorites and celebrating the makers, customers, and families who inspire our work every day. Drop your favorite memory with us! #Craftsmanship #CommunityLove`,
          vibe: { kind: 'Creating', label: `${user.name} Studio` },
          comments: [
            {
              id: `lc-${user.id}-1a`,
              authorId: c1.id,
              text: `Always reliable quality—glad to see you active on Sphere.!`,
              createdAt: '20 mins ago',
              likes: 3,
            },
          ],
          types: ['fire', 'heart', 'clap'],
        },
        {
          suffix: '2',
          createdAt: '2 days ago',
          content: `Behind the scenes at ${user.workplace}: every detail starts on a sketchpad and gets refined with community feedback. Here is a peek at what we have been building this season. #DesignProcess`,
          vibe: { kind: 'At', label: user.location },
          photoId: resolvedPhoto1Id,
          comments: [],
          types: ['heart', 'fire', 'clap'],
        },
        {
          suffix: '3',
          createdAt: '5 days ago',
          content: `Thank you to our friends across the Philippines and worldwide for making every release feel like a neighborhood celebration! #SpherePartners`,
          vibe: { kind: 'Throwback', label: 'Community Launch Day' },
          photoId: resolvedPhoto2Id,
          comments: [],
          types: ['clap', 'heart'],
        }
      );
    } else if (archetype === 'hero') {
      templates.push(
        {
          suffix: '1',
          createdAt: '24 mins ago',
          content: `Just wrapped a busy morning as ${user.occupation} in ${city}! Honestly thought I'd miss lunch again, but grabbed ${user.favoriteFood?.toLowerCase()} just in time before the next adventure started. What's everyone up to today? #EverydayHero #SliceOfLife`,
          vibe: { kind: 'At', label: `${city} Rooftops & Cafes` },
          comments: [
            {
              id: `lc-${user.id}-1a`,
              authorId: c1.id,
              text: `Haha you never take a real day off, ${first}! Save a slice for the rest of us.`,
              createdAt: '12 mins ago',
              likes: 4,
            },
            {
              id: `lc-${user.id}-1b`,
              authorId: c2.id,
              text: `Drop by Adrian's circle later—we're swapping stories!`,
              createdAt: '6 mins ago',
              likes: 2,
            },
          ],
          types: ['laugh', 'heart', 'fire'],
        },
        {
          suffix: '2',
          createdAt: 'Yesterday',
          content: `Caught this view right before heading home. Even when things get hectic, taking five minutes to breathe and look at the skyline makes all the difference. #GoldenHour #FriendsForever`,
          vibe: { kind: 'Throwback', label: 'Sunset Patrol' },
          photoId: resolvedPhoto1Id,
          comments: [],
          types: ['heart', 'fire', 'clap'],
        },
        {
          suffix: '3',
          createdAt: '5 days ago',
          content: `Note to self: double-check gadgets, charge the camera battery, and never skip breakfast. Hoping everybody in my friends list has a great week ahead! ✨`,
          vibe: { kind: 'Listening', label: 'Classic Adventure Soundtracks' },
          comments: [],
          types: ['heart', 'laugh', 'clap'],
        }
      );
    } else if (archetype === 'leader') {
      templates.push(
        {
          suffix: '1',
          createdAt: '1 hour ago',
          content: `Reflecting on constructive dialogue and local education initiatives today from ${city}. Real progress always begins in everyday conversations between neighbors, teachers, and builders. #CivicDialogue #EducationFirst`,
          vibe: { kind: 'Reading', label: 'Civic History & Public Policy Notes' },
          comments: [
            {
              id: `lc-${user.id}-1a`,
              authorId: c1.id,
              text: `Well said—education and grassroots listening always matter most.`,
              createdAt: '40 mins ago',
              likes: 5,
            },
          ],
          types: ['clap', 'heart', 'clap'],
        },
        {
          suffix: '2',
          createdAt: '3 days ago',
          content: `Thankful for open forums where people from different towns and backgrounds can share honest ideas respectfully. Looking forward to reading everyone's thoughts this week. #CommunityLeadership`,
          vibe: { kind: 'At', label: user.location },
          photoId: resolvedPhoto1Id,
          comments: [],
          types: ['clap', 'heart'],
        },
        {
          suffix: '3',
          createdAt: '6 days ago',
          content: `Quote I kept on my desk this morning: “${user.quote}” Wishing everyone strength and wisdom for the days ahead.`,
          vibe: { kind: 'Throwback', label: 'Townhall Archive' },
          comments: [],
          types: ['heart', 'clap'],
        }
      );
    } else if (archetype === 'creative') {
      templates.push(
        {
          suffix: '1',
          createdAt: '31 mins ago',
          content: `Late-night desk session at ${user.workplace} with ${user.favoriteFood?.toLowerCase()} beside my sketchbook. Finally cracked a tricky scene I've been reworking all week! How is everyone else's creative energy tonight? #Worldbuilding #LateNightStudio`,
          vibe: { kind: 'Creating', label: `${user.occupation}` },
          comments: [
            {
              id: `lc-${user.id}-1a`,
              authorId: c1.id,
              text: `Can't wait to see the finished piece, ${first}! Your atmosphere is always unmatched.`,
              createdAt: '14 mins ago',
              likes: 3,
            },
          ],
          types: ['fire', 'heart', 'clap'],
        },
        {
          suffix: '2',
          createdAt: '2 days ago',
          content: `Captured textures, shadows, and color palettes around ${city} for my next lore chapter. Sometimes stepping outside with a camera solves every creative block. #ConceptArt #VisualNotes`,
          vibe: { kind: 'At', label: `${city} After Dusk` },
          photoId: resolvedPhoto1Id,
          comments: [
            {
              id: `lc-${user.id}-2a`,
              authorId: c2.id,
              text: `Those tones look straight out of an indie film.`,
              createdAt: 'Yesterday',
              likes: 2,
            },
          ],
          types: ['heart', 'fire'],
        },
        {
          suffix: '3',
          createdAt: '5 days ago',
          content: `Sharing a little studio reminder: finish the messy draft first, polish later. Proud of every artist and writer pushing forward today. ✍️`,
          vibe: { kind: 'Listening', label: 'Atmospheric Instrumental Mix' },
          photoId: resolvedPhoto2Id,
          comments: [],
          types: ['clap', 'heart'],
        }
      );
    } else {
      templates.push(
        {
          suffix: '1',
          createdAt: `${(seed % 50) + 10} mins ago`,
          content: `Busy but rewarding day as ${user.occupation} here in ${city}! Taking a breather with ${user.favoriteFood?.toLowerCase()} before jumping into ${user.hobbies?.[0]?.toLowerCase() || 'evening plans'}. Hope everyone in my circle is having a great day! #LifeUpdate #${city.replace(/\s+/g, '')}`,
          vibe: { kind: 'At', label: user.workplace || city },
          comments: [
            {
              id: `lc-${user.id}-1a`,
              authorId: c1.id,
              text: `Sounds like a great balance, ${first}! Let's catch up soon.`,
              createdAt: '8 mins ago',
              likes: 2,
            },
            {
              id: `lc-${user.id}-1b`,
              authorId: c2.id,
              text: `Save some of that ${user.favoriteFood?.split('&')[0]?.trim().toLowerCase() || 'coffee'} for the rest of us 😄`,
              createdAt: '3 mins ago',
              likes: 1,
            },
          ],
          types: ['heart', 'clap', 'laugh'],
        },
        {
          suffix: '2',
          createdAt: 'Yesterday at 6:15 PM',
          content: `Afternoon light around ${city} looked too good not to post. Still loving the routine of ${user.currentlyInto?.toLowerCase() || 'slow evenings and good music'}. #EverydayMoments`,
          vibe: { kind: 'Creating', label: user.hobbies?.[0] || 'Life Snapshot' },
          photoId: resolvedPhoto1Id,
          comments: [
            {
              id: `lc-${user.id}-2a`,
              authorId: c3.id,
              text: `Great shot! Missing ${city} vibes.`,
              createdAt: '14 hours ago',
              likes: 2,
            },
          ],
          types: ['heart', 'fire', 'clap'],
        },
        {
          suffix: '3',
          createdAt: '5 days ago',
          content: `Checking off a personal milestone this week at ${user.workplace}—super thankful for mentors and friends who keep cheering from near and far! 🙌 #Progress #SphereFriends`,
          vibe: { kind: 'Listening', label: user.currentlyInto || 'Weekend Playlist' },
          photoId: resolvedPhoto2Id,
          comments: [],
          types: ['clap', 'heart', 'fire'],
        }
      );
    }

    for (const tpl of templates) {
      const postId = `life-post-${user.id}-${tpl.suffix}`;
      if (db.posts.some((p) => p.id === postId)) continue;
      const r = buildReactionMap([c1, c2, c3], tpl.types);
      db.posts.push({
        id: postId,
        authorId: user.id,
        content: tpl.content,
        location: user.location,
        country: user.country,
        language: user.preferredLanguage || 'English',
        createdAt: tpl.createdAt,
        likes: r.likes,
        reactions: r.reactions,
        reactionTracker: r.reactionTracker,
        comments: tpl.comments,
        photoId: tpl.photoId,
        sharesCount: (seed % 5) + 1,
        privacy: 'public',
        vibe: tpl.vibe,
      });
      changed = true;
    }
  }

  // Ensure at least 1 warm testimonial exists on their profile
  if (!db.testimonials.some((t) => t.recipientId === user.id)) {
    db.testimonials.push({
      id: `life-testi-${user.id}`,
      authorId: c1.id,
      recipientId: user.id,
      quote:
        archetype === 'org' || archetype === 'brand'
          ? `${user.name} consistently brings reliable updates and genuine community support across Sphere.`
          : `${first} is one of the warmest, most genuine people you will ever meet—always showing up for friends in ${city} and beyond.`,
      createdAt: '3 days ago',
    });
    changed = true;
  }

  const posts = db.posts.filter(
    (p) =>
      (p.authorId === user.id && !p.postAsPage) ||
      p.targetProfileId === user.id ||
      (p.approvedTagUserIds || []).includes(user.id)
  );
  const photos = db.photos.filter((ph) => ph.ownerId === user.id && !ph.postAsPage);
  const albums = db.albums.filter((a) => a.ownerId === user.id);
  const testimonials = db.testimonials.filter((t) => t.recipientId === user.id);

  return { changed, posts, photos, albums, testimonials };
}
