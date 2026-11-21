import { DiscoveryCategory, UserProfile } from '../types/social';
import { computeInterestMatch } from './discovery';

export const TOTAL_GLOBAL_DIRECTORY_COUNT = 100000;

interface RegionHub {
  country: string;
  city: string;
  language: string;
  preferredLanguage: string;
  firstNames: string[];
  lastNames: string[];
}

const REGION_HUBS: RegionHub[] = [
  {
    country: 'Philippines',
    city: 'Labo, Camarines Norte, Philippines',
    language: 'Tagalog, Bikol & English',
    preferredLanguage: 'Tagalog',
    firstNames: ['Mateo', 'Bianca', 'Rafael', 'Camille', 'Gabriel', 'Tala', 'Paolo', 'Hannah', 'Miguel', 'Cheska'],
    lastNames: ['Villanueva', 'Canal', 'Celestial', 'Reyes', 'Santos', 'Bautista', 'Mendoza', 'Aguilar', 'Soriano', 'Ocampo'],
  },
  {
    country: 'Philippines',
    city: 'Daet, Camarines Norte, Philippines',
    language: 'Tagalog, Bikol & English',
    preferredLanguage: 'English',
    firstNames: ['Marco', 'Clarisse', 'Dante', 'Katrina', 'Noel', 'Alyssa', 'Enzo', 'Mikaela', 'Carlo', 'Trisha'],
    lastNames: ['Dela Cruz', 'Pardo', 'Balce', 'Ibita', 'Nolasco', 'Abad', 'Solis', 'Ferrer', 'Lozano', 'Aquino'],
  },
  {
    country: 'Philippines',
    city: 'Manila, Philippines',
    language: 'Tagalog & English',
    preferredLanguage: 'English',
    firstNames: ['Lucas', 'Nadine', 'Joaquin', 'Ysabel', 'Andres', 'bea', 'nico', 'Sam', 'Anton', 'Kylie'],
    lastNames: ['Zobel', 'Lim', 'Tan', 'Gomez', 'Salazar', 'Castillo', 'Roque', 'Garcia', 'Velasco', 'Domingo'],
  },
  {
    country: 'Philippines',
    city: 'Cebu City, Philippines',
    language: 'Cebuano, Tagalog & English',
    preferredLanguage: 'English',
    firstNames: ['Jude', 'Claire', 'kenji', 'Rhea', 'Vince', 'Chloe', 'Aeron', 'Pia', 'Christian', 'Erika'],
    lastNames: ['Osmena', 'Ybanez', 'Aboitiz', 'Lapid', 'Cuizon', 'Cabrera', 'Neri', 'Cortes', 'Borja', 'Seno'],
  },
  {
    country: 'Japan',
    city: 'Tokyo, Japan',
    language: 'Japanese & English',
    preferredLanguage: 'Japanese',
    firstNames: ['Haruto', 'Yui', 'Sota', 'Hina', 'Ren', 'Aoi', 'Kaito', 'Sakura', 'Daiki', 'Mio'],
    lastNames: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Kobayashi', 'Kato', 'Nakamura'],
  },
  {
    country: 'South Korea',
    city: 'Seoul, South Korea',
    language: 'Korean & English',
    preferredLanguage: 'Korean',
    firstNames: ['Jiwon', 'Seojun', 'Haeun', 'Doyun', 'Sujin', 'Hyunwoo', 'Nari', 'Taeyang', 'Yuna', 'Joon'],
    lastNames: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Han'],
  },
  {
    country: 'United States',
    city: 'San Francisco, United States',
    language: 'English',
    preferredLanguage: 'English',
    firstNames: ['Ethan', 'Maya', 'Noah', 'Aria', 'Liam', 'Elena', 'Julian', 'Chloe', 'mason', 'Zoe'],
    lastNames: ['Carter', 'Bennett', 'Brooks', 'Reed', 'Hayes', 'Morgan', 'Cooper', 'Patel', 'Nguyen', 'Rivera'],
  },
  {
    country: 'United States',
    city: 'New York, United States',
    language: 'English & Spanish',
    preferredLanguage: 'English',
    firstNames: ['Owen', 'Nora', 'Caleb', 'Avery', 'Miles', 'Clara', 'Julian', 'Ruby', 'Jasper', 'Lena'],
    lastNames: ['Cole', 'Foster', 'Grant', 'Ross', 'Perry', 'Morales', 'Vance', 'Sloan', 'Kim', 'Ortiz'],
  },
  {
    country: 'United Kingdom',
    city: 'London, United Kingdom',
    language: 'English',
    preferredLanguage: 'English',
    firstNames: ['Oliver', 'Amelia', 'George', 'Isla', 'Arthur', 'Freya', 'Theo', 'Poppy', 'Leo', 'Evie'],
    lastNames: ['Wright', 'Taylor', 'Clarke', 'Evans', 'Hughes', 'Edwards', 'Turner', 'Davies', 'Bell', 'Ward'],
  },
  {
    country: 'Canada',
    city: 'Vancouver, Canada',
    language: 'English & French',
    preferredLanguage: 'English',
    firstNames: ['Liam', 'Charlotte', 'Nathan', 'Sophie', 'Logan', 'Audrey', 'Xavier', 'Camille', 'Dylan', 'Chloé'],
    lastNames: ['Tremblay', 'Gagnon', 'Roy', 'Mercier', 'Bouchard', 'Martin', 'MacLeod', 'Campbell', 'Wong', 'Gill'],
  },
  {
    country: 'Germany',
    city: 'Berlin, Germany',
    language: 'German & English',
    preferredLanguage: 'German',
    firstNames: ['Lukas', 'Hannah', 'Jonas', 'Lea', 'Felix', 'Mia', 'Paul', 'Lina', 'Leon', 'Clara'],
    lastNames: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schäfer'],
  },
  {
    country: 'Spain',
    city: 'Madrid, Spain',
    language: 'Spanish & English',
    preferredLanguage: 'Spanish',
    firstNames: ['Mateo', 'Lucía', 'Daniel', 'Martina', 'Hugo', 'Paula', 'Pablo', 'Valeria', 'Álvaro', 'Alma'],
    lastNames: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Hernández', 'Díaz'],
  },
  {
    country: 'France',
    city: 'Paris, France',
    language: 'French & English',
    preferredLanguage: 'French',
    firstNames: ['Gabriel', 'Emma', 'Raphaël', 'Jade', 'Louis', 'Louise', 'Jules', 'Alice', 'Arthur', 'Chloé'],
    lastNames: ['Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon'],
  },
  {
    country: 'Brazil',
    city: 'São Paulo, Brazil',
    language: 'Portuguese & English',
    preferredLanguage: 'Portuguese',
    firstNames: ['Miguel', 'Helena', 'Gael', 'Alice', 'Heitor', 'Laura', 'Davi', 'Sophia', 'Bernardo', 'Manuela'],
    lastNames: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Costa'],
  },
  {
    country: 'Mexico',
    city: 'Mexico City, Mexico',
    language: 'Spanish & English',
    preferredLanguage: 'Spanish',
    firstNames: ['Santiago', 'Sofía', 'Sebastián', 'Valentina', 'Matías', 'Regina', 'Diego', 'Camila', 'Emiliano', 'Ximena'],
    lastNames: ['Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Flores'],
  },
  {
    country: 'India',
    city: 'Bengaluru, India',
    language: 'English, Hindi & Kannada',
    preferredLanguage: 'English',
    firstNames: ['Aarav', 'Ananya', 'Vivaan', 'Diya', 'Aditya', 'Isha', 'Rohan', 'Meera', 'Kabir', 'Kavya'],
    lastNames: ['Sharma', 'Patel', 'Nair', 'Rao', 'Verma', 'Kulkarni', 'Iyer', 'Menon', 'Gupta', 'Desai'],
  },
  {
    country: 'Singapore',
    city: 'Singapore',
    language: 'English, Mandarin & Malay',
    preferredLanguage: 'English',
    firstNames: ['Ryan', 'Cheryl', 'Marcus', 'Rachel', 'Darren', 'Nicole', 'Jovan', 'felicia', 'Aiden', 'Hannah'],
    lastNames: ['Tan', 'Lim', 'Lee', 'Ng', 'Ong', 'Wong', 'Koh', 'Teo', 'Yeo', 'Ho'],
  },
  {
    country: 'Australia',
    city: 'Melbourne, Australia',
    language: 'English',
    preferredLanguage: 'English',
    firstNames: ['Oliver', 'Charlotte', 'Jack', 'Mia', 'Noah', 'Amelia', 'Henry', 'Olivia', 'Leo', 'Grace'],
    lastNames: ['Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'White', 'Walker'],
  },
  {
    country: 'Nigeria',
    city: 'Lagos, Nigeria',
    language: 'English & Yoruba',
    preferredLanguage: 'English',
    firstNames: ['Tunde', 'Amaka', 'Chidi', 'Zainab', 'Kelechi', 'Sade', 'Emeka', 'Funke', 'Babatunde', 'Ngozi'],
    lastNames: ['Adeyemi', 'Okafor', 'Balogun', 'Ibrahim', 'Olatunji', 'Nwosu', 'Akinola', 'Eze', 'Ogunleye', 'Suleiman'],
  },
  {
    country: 'South Africa',
    city: 'Cape Town, South Africa',
    language: 'English, Afrikaans & Xhosa',
    preferredLanguage: 'English',
    firstNames: ['Liam', 'Thandi', 'Sipho', 'Annelize', 'Kagiso', 'Zanele', 'Pieter', 'Lindiwe', 'Brandon', 'Nomsa'],
    lastNames: ['Nkosi', 'Botha', 'van der Merwe', 'Dlamini', 'Ndlovu', 'Mokoena', 'Zulu', 'Naidoo', 'Jacobs', 'Khumalo'],
  },
];

const PERSONAS: {
  bioTemplate: string;
  statusTemplate: string;
  quote: string;
  interests: string[];
  hobbies: string[];
  skills: string[];
  goals: string[];
  categories: DiscoveryCategory[];
}[] = [
  {
    bioTemplate: 'Community baker and pastry crafter exploring local ingredients and heirloom recipes.',
    statusTemplate: 'Preheating the oven for morning batches!',
    quote: 'Good food always brings neighbors together.',
    interests: ['Baking', 'Local Food', 'Artisan Pastry', 'Coffee'],
    hobbies: ['Recipe Testing', 'Food Photography', 'Farmers Markets'],
    skills: ['Pastry Craft', 'Kitchen Operations', 'Packaging'],
    goals: ['Share family recipes across Sphere.'],
    categories: ['Lifestyle', 'Business'],
  },
  {
    bioTemplate: 'Visual designer & front-end creative building warm human-centered interfaces.',
    statusTemplate: 'Sketching new brand marks and typography experiments.',
    quote: 'Clarity and craft turn utility into joy.',
    interests: ['UI Design', 'Typography', 'Illustration', 'Branding'],
    hobbies: ['Sketching', 'Museum Walks', 'Vinyl Records'],
    skills: ['Visual Identity', 'Motion Design', 'Design Systems'],
    goals: ['Collaborate with independent creators worldwide'],
    categories: ['Art', 'Technology'],
  },
  {
    bioTemplate: 'Full-stack developer, open-source contributor, and weekend trail cyclist.',
    statusTemplate: 'Shipping clean code and brewing pour-over coffee.',
    quote: 'Build tools that respect people’s time and privacy.',
    interests: ['Web Architecture', 'AI Tools', 'Open Source', 'Cycling'],
    hobbies: ['Mechanical Keyboards', 'Trail Riding', 'Reading'],
    skills: ['TypeScript', 'Distributed Systems', 'Product Engineering'],
    goals: ['Mentor early-career developers globally'],
    categories: ['Technology', 'Sports'],
  },
  {
    bioTemplate: 'Contemporary painter & muralist documenting coastal landscapes and folk heritage.',
    statusTemplate: 'Mixing ochre and turquoise pigments in the studio.',
    quote: 'Every street corner holds a color story.',
    interests: ['Acrylic Painting', 'Murals', 'Cultural Heritage', 'Art'],
    hobbies: ['Plein Air Sketching', 'Pottery', 'Travel Journals'],
    skills: ['Color Theory', 'Portrait Art', 'Community Workshops'],
    goals: ['Host cross-cultural youth art exchanges'],
    categories: ['Art', 'Education'],
  },
  {
    bioTemplate: 'Indie music producer, acoustic guitarist, and lo-fi beat curator.',
    statusTemplate: 'Listening: midnight guitar loops & rain ambience.',
    quote: 'Music crosses borders without needing a passport.',
    interests: ['Music Production', 'Indie Acoustic', 'Vinyl', 'Sound Design'],
    hobbies: ['Home Recording', 'Concert Photography', 'Synthesizers'],
    skills: ['Audio Mixing', 'Songwriting', 'Guitar'],
    goals: ['Jam remotely with Sphere. musicians'],
    categories: ['Music', 'Art'],
  },
  {
    bioTemplate: 'Travel chronicler & documentary photographer capturing coastal sunrises.',
    statusTemplate: 'Packing light for the next sunrise hike.',
    quote: 'Travel is about listening first to the places you visit.',
    interests: ['Travel Photography', 'Surfing', 'Documentary', 'Nature'],
    hobbies: ['Street Photography', 'Camping', 'Language Learning'],
    skills: ['Photojournalism', 'Short Video Loops', 'Storytelling'],
    goals: ['Document 50 local festivals around the world'],
    categories: ['Travel', 'Art'],
  },
  {
    bioTemplate: 'Educator, civic volunteer, and youth STEM facilitator supporting local schools.',
    statusTemplate: 'Preparing weekend workshop kits for students.',
    quote: 'Shared knowledge multiplies every time we teach.',
    interests: ['Education', 'Civic Volunteering', 'Mentorship', 'Books'],
    hobbies: ['Chess', 'Public Libraries', 'Gardening'],
    skills: ['Curriculum Design', 'Public Speaking', 'Project Coordination'],
    goals: ['Expand accessible community learning spaces'],
    categories: ['Education', 'Lifestyle'],
  },
  {
    bioTemplate: 'Co-op entrepreneur, indie game strategist, and tabletop worldbuilder.',
    statusTemplate: 'Playtesting co-op campaign mechanics tonight!',
    quote: 'Great games create friendships that outlast the scoreboard.',
    interests: ['Gaming', 'Co-op RPGs', 'Board Games', 'Esports'],
    hobbies: ['Speedrunning', 'Pixel Art', 'Trivia Nights'],
    skills: ['Game Balancing', 'Community Hosting', 'Live Streaming'],
    goals: ['Run friendly international Sphere. tournaments'],
    categories: ['Gaming', 'Technology'],
  },
];

const AVATAR_PALETTES = [
  '#4F46E5',
  '#0891B2',
  '#0F766E',
  '#D97706',
  '#DB2777',
  '#7C3AED',
  '#059669',
  '#2563EB',
  '#B45309',
  '#6366F1',
];

function capWord(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generates any deterministic complete imaginary user profile for index 0..99,999 in O(1) time.
 */
export function getVirtualUserByIndex(index: number): UserProfile {
  const safeIdx = ((index % TOTAL_GLOBAL_DIRECTORY_COUNT) + TOTAL_GLOBAL_DIRECTORY_COUNT) % TOTAL_GLOBAL_DIRECTORY_COUNT;
  const hub = REGION_HUBS[safeIdx % REGION_HUBS.length];
  const fnIdx = Math.floor(safeIdx / REGION_HUBS.length) % hub.firstNames.length;
  const lnIdx = Math.floor(safeIdx / (REGION_HUBS.length * hub.firstNames.length)) % hub.lastNames.length;
  const midTag = Math.floor(safeIdx / (REGION_HUBS.length * hub.firstNames.length * hub.lastNames.length));

  const first = capWord(hub.firstNames[fnIdx]);
  const last = capWord(hub.lastNames[lnIdx]);
  const persona = PERSONAS[(safeIdx * 7 + lnIdx) % PERSONAS.length];
  const idNum = String(safeIdx + 1).padStart(6, '0');
  const fullName = midTag > 0 ? `${first} ${last} ${midTag}` : `${first} ${last}`;
  const cleanHandleBase = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const handle = `${cleanHandleBase}.${idNum}`;

  const years = ['2024', '2025', '2026'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

  return {
    id: `virt-${idNum}`,
    role: 'member',
    name: fullName,
    handle,
    avatarColor: AVATAR_PALETTES[safeIdx % AVATAR_PALETTES.length],
    status: persona.statusTemplate,
    location: hub.city,
    country: hub.country,
    language: hub.language,
    preferredLanguage: hub.preferredLanguage,
    autoTranslate: true,
    interests: persona.interests,
    hobbies: persona.hobbies,
    skills: persona.skills,
    goals: persona.goals,
    categories: persona.categories,
    quote: persona.quote,
    bio: `${persona.bioTemplate} Based in ${hub.city}.`,
    joinedDate: `${months[safeIdx % months.length]} ${years[safeIdx % years.length]}`,
    friendCount: 18 + ((safeIdx * 13) % 480),
    photoCount: 4 + ((safeIdx * 5) % 64),
    groupCount: 1 + (safeIdx % 9),
    friendship: 'none',
    mutualFriends: safeIdx % 5,
    privacy: 'public',
    sphereIdCategory: safeIdx % 11 === 0 ? 'verified_individual' : 'unverified',
    verified: safeIdx % 11 === 0,
    locationDiscoveryEnabled: true,
    preferredScope: 'global',
  };
}

export function getVirtualUserById(id: string): UserProfile | null {
  const match = /^virt-(\d{6})$/.exec(id);
  if (!match) return null;
  const idx = Number(match[1]) - 1;
  if (idx < 0 || idx >= TOTAL_GLOBAL_DIRECTORY_COUNT) return null;
  return getVirtualUserByIndex(idx);
}

export const GLOBAL_DIRECTORY_COUNTRIES: string[] = Array.from(
  new Set(REGION_HUBS.map((h) => h.country))
);

export interface DirectoryQueryResult {
  totalMatched: number;
  totalGlobalPopulation: number;
  page: number;
  limit: number;
  totalPages: number;
  items: (UserProfile & { matchScore: number; sharedSignals: string[] })[];
}

export function queryGlobalDirectory(params: {
  viewer?: UserProfile;
  page?: number;
  limit?: number;
  query?: string;
  country?: string;
  category?: DiscoveryCategory | 'All';
  friendSet?: Set<string>;
  outgoingSet?: Set<string>;
}): DirectoryQueryResult {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(48, Math.max(6, params.limit || 24));
  const q = (params.query || '').trim().toLowerCase();
  const countryFilter = (params.country || 'All').trim();
  const catFilter = params.category || 'All';

  // Fast O(1) path when unfiltered!
  if (!q && countryFilter === 'All' && catFilter === 'All') {
    const start = (page - 1) * limit;
    const items: (UserProfile & { matchScore: number; sharedSignals: string[] })[] = [];
    for (let i = start; i < Math.min(start + limit, TOTAL_GLOBAL_DIRECTORY_COUNT); i += 1) {
      const u = applyRelationshipStatus(getVirtualUserByIndex(i), params.friendSet, params.outgoingSet);
      const match = params.viewer
        ? computeInterestMatch(params.viewer, u)
        : { score: 0, allShared: [] as string[] };
      items.push({ ...u, matchScore: match.score, sharedSignals: match.allShared });
    }
    return {
      totalMatched: TOTAL_GLOBAL_DIRECTORY_COUNT,
      totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
      page,
      limit,
      totalPages: Math.ceil(TOTAL_GLOBAL_DIRECTORY_COUNT / limit),
      items,
    };
  }

  // Deterministic filtered scan capped safely so 100k queries finish in <15ms
  const matchingHubIndices = REGION_HUBS.map((h, i) => ({ h, i })).filter(
    ({ h }) => countryFilter === 'All' || h.country.toLowerCase() === countryFilter.toLowerCase()
  );
  const ratio =
    (matchingHubIndices.length / REGION_HUBS.length) *
    (catFilter === 'All' ? 1 : 0.35) *
    (q ? 0.08 : 1);

  const collected: (UserProfile & { matchScore: number; sharedSignals: string[] })[] = [];
  const skipTarget = (page - 1) * limit;
  let foundCount = 0;

  // Scan step over deterministic index space
  const maxIterations = Math.min(TOTAL_GLOBAL_DIRECTORY_COUNT, q ? 35000 : 12000);
  for (let i = 0; i < maxIterations; i += 1) {
    if (countryFilter !== 'All') {
      const hub = REGION_HUBS[i % REGION_HUBS.length];
      if (hub.country.toLowerCase() !== countryFilter.toLowerCase()) continue;
    }
    const candidate = getVirtualUserByIndex(i);
    if (catFilter !== 'All' && !(candidate.categories || []).includes(catFilter)) continue;
    if (
      q &&
      !candidate.name.toLowerCase().includes(q) &&
      !candidate.handle.toLowerCase().includes(q) &&
      !candidate.location.toLowerCase().includes(q) &&
      !candidate.bio.toLowerCase().includes(q) &&
      !candidate.interests.some((int) => int.toLowerCase().includes(q))
    ) {
      continue;
    }
    if (foundCount >= skipTarget && collected.length < limit) {
      const enriched = applyRelationshipStatus(candidate, params.friendSet, params.outgoingSet);
      const match = params.viewer
        ? computeInterestMatch(params.viewer, enriched)
        : { score: 0, allShared: [] as string[] };
      collected.push({ ...enriched, matchScore: match.score, sharedSignals: match.allShared });
    }
    foundCount += 1;
    if (collected.length >= limit && foundCount > skipTarget + limit) {
      break;
    }
  }

  const estimatedTotal = q
    ? Math.max(collected.length + foundCount, Math.round(TOTAL_GLOBAL_DIRECTORY_COUNT * ratio))
    : Math.max(collected.length, Math.round(TOTAL_GLOBAL_DIRECTORY_COUNT * ratio));

  return {
    totalMatched: estimatedTotal,
    totalGlobalPopulation: TOTAL_GLOBAL_DIRECTORY_COUNT,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(estimatedTotal / limit)),
    items: collected,
  };
}

function applyRelationshipStatus(
  u: UserProfile,
  friendSet?: Set<string>,
  outgoingSet?: Set<string>
): UserProfile {
  if (friendSet?.has(u.id)) return { ...u, friendship: 'friends' };
  if (outgoingSet?.has(u.id)) return { ...u, friendship: 'requested_outgoing' };
  return u;
}

export function sampleGlobalMemberIds(params: {
  count: number;
  country?: string;
  category?: DiscoveryCategory | 'All';
  excludeIds?: Set<string>;
}): string[] {
  const target = Math.max(0, Math.min(5000, Math.floor(params.count || 0)));
  const countryFilter = (params.country || 'All').trim().toLowerCase();
  const catFilter = params.category || 'All';
  const results: string[] = [];

  for (let i = 0; i < TOTAL_GLOBAL_DIRECTORY_COUNT && results.length < target; i += 1) {
    if (countryFilter !== 'all') {
      const hub = REGION_HUBS[i % REGION_HUBS.length];
      if (hub.country.toLowerCase() !== countryFilter) continue;
    }
    const candidate = getVirtualUserByIndex(i);
    if (params.excludeIds?.has(candidate.id)) continue;
    if (catFilter !== 'All' && !(candidate.categories || []).includes(catFilter)) continue;
    results.push(candidate.id);
  }
  return results;
}
