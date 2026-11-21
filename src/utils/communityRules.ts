export interface CategoryGuidelinePreset {
  category: string;
  rules: string[];
  postingPolicy: string;
  guidelinesSummary: string;
}

export const PAGE_AND_GROUP_CATEGORIES = [
  'Computer Parts & Hardware',
  'Social Works & Outreach',
  'Motorcycles & Riding',
  'Arts & Culture',
  'Government & LGU',
  'Local Food & Enterprise',
  'Artisan Bakery',
  'Design Studio',
  'Agriculture & Ecology',
  'Coffee & Culinary',
  'Education & STEM',
  'Fitness & Sports',
  'Travel & Heritage',
  'Community & Craft',
  'Food & Baking',
  'Art & Design',
] as const;

export function getCategoryGuidelines(category: string, isGroup = false): CategoryGuidelinePreset {
  const norm = (category || '').toLowerCase();

  if (norm.includes('government') || norm.includes('lgu') || norm.includes('civic')) {
    return {
      category,
      rules: [
        'Verify official barangay advisories, weather alerts, and ordinance numbers before resharing.',
        'Respectful civic discourse only — no partisan mudslinging, defamation, or false emergency rumors.',
        'Protect citizen privacy: never publish minors’ identities or unredacted personal documents in comments.',
        'Direct urgent rescue or emergency dispatches immediately to MDRRMO / Barangay hotlines.',
        'Zero commercial spam, pyramid schemes, or unauthorized campaign solicitations.',
      ],
      postingPolicy:
        'Official municipal advisories, public hearings, disaster preparedness notices, and verified community feedback.',
      guidelinesSummary:
        'Civic Public Service Standards: factual advisories, Data Privacy Act compliance, and constructive citizen dialogue.',
    };
  }

  if (norm.includes('food') || norm.includes('bakery') || norm.includes('culinary') || norm.includes('baking') || norm.includes('coffee')) {
    return {
      category,
      rules: [
        'Disclose major food allergens clearly (coconut/macapuno, dairy, eggs, wheat, peanuts, soy).',
        'Honor posted shelf-life, food-handling hygiene, and sanitary permit standards on all food trays.',
        'Post transparent prices, tray sizes, pickup hours, and cut-off times before confirming reservations.',
        'Keep taste reviews constructive and honest; no competitor harassment or fabricated spoilage claims.',
        'Orders and pickup schedules must be confirmed respectfully without last-minute ghosting.',
      ],
      postingPolicy:
        'Fresh batch announcements, recipe craft notes, allergen disclosures, honest tasting feedback, and pickup updates.',
      guidelinesSummary:
        'Food Safety & Hospitality Charter: full allergen transparency, honest pricing, and respectful support for homegrown kitchens.',
    };
  }

  if (norm.includes('computer') || norm.includes('hardware') || norm.includes('pc') || norm.includes('tech')) {
    return {
      category,
      rules: [
        'State full hardware specs cleanly: exact model, purchase year, warranty status, and any repair history.',
        'All pre-owned parts (GPUs, CPUs, PSUs, RAM, SSDs) require timestamped benchmark or stress-test proof.',
        'No fake VRAM/BIOS-flashed cards, gray-market scams, pirated software keys, or scalper markups.',
        'Give objective troubleshooting help (thermals, wattage headroom, bottleneck checks) without brand gatekeeping.',
        'Verify meetup spots in well-lit public places or use tested video proof before shipping.',
      ],
      postingPolicy:
        'Spec sheets, thermal benchmarks, build logs, honest troubleshooting, and verified parts buy-and-sell.',
      guidelinesSummary:
        'Hardware Integrity Charter: timestamped stress tests, zero counterfeit parts, and constructive technical troubleshooting.',
    };
  }

  if (norm.includes('social') || norm.includes('outreach') || norm.includes('aid') || norm.includes('relief')) {
    return {
      category,
      rules: [
        'Every cash or in-kind drive must publish clear beneficiary goals and post-activity liquidation photos.',
        'Dignity-first photography: never exploit poverty, trauma, or minors’ faces without guardian consent.',
        'Coordinate directly with Barangay councils, DSWD, or school heads before distributing relief in any sitio.',
        'Personal bank/GCash solicitations without a verified organization page or ledger are strictly prohibited.',
        'Volunteers must follow field safety, zero-discrimination, and zero-political-branding rules.',
      ],
      postingPolicy:
        'Volunteer calls, verified supply drives, transparent distribution ledgers, and community impact updates.',
      guidelinesSummary:
        'Dignity & Transparency Code: 100% open aid ledgers, consent-based storytelling, and barangay-coordinated outreach.',
    };
  }

  if (norm.includes('motor') || norm.includes('ride') || norm.includes('riding') || norm.includes('bike')) {
    return {
      category,
      rules: [
        'ATGATT discipline on every group ride: full-face DOT/ECE helmet, gloves, footwear, and working lights.',
        'Strict zero-tolerance against public road racing, kamote counterflowing, and open-pipe noise violations.',
        'No drinking before or during rides; follow staggered formation and sweepers’ hand signals.',
        'List honest tire tread, OR/CR registration status, and mechanical flaws on any bike or parts post.',
        'Respect local residents, pedestrians, cyclists, and livestock when cruising through provincial towns.',
      ],
      postingPolicy:
        'Safe ride routes, maintenance tips, helmet/gear reviews, verified OR/CR bike listings, and defensive riding habits.',
      guidelinesSummary:
        'Safe Throttle Charter: full protective gear mandatory, respect road rules and quiet town hours, zero reckless stunting.',
    };
  }

  if (norm.includes('art') || norm.includes('design') || norm.includes('culture') || norm.includes('craft')) {
    return {
      category,
      rules: [
        'Credit original artists, photographers, and traditional artisans cleanly whenever sharing or remixing work.',
        'Zero tracing, unauthorized AI re-uploads claimed as hand-painted, or uncredited commercial reposts.',
        'Keep portfolio critiques specific, actionable, and encouraging—critique technique, never the artist.',
        'Commission posts must state turnaround time, revision limits, usage rights, and fair downpayment terms.',
        'Respect cultural heritage motifs, indigenous weaves, and local festival symbolism.',
      ],
      postingPolicy:
        'Original studio works, WIP sketches, process breakdowns, respectful critiques, and commission availability.',
      guidelinesSummary:
        'Creator Respect Charter: original authorship credit, constructive peer critique, and fair creative licensing.',
    };
  }

  if (norm.includes('agri') || norm.includes('eco') || norm.includes('farm') || norm.includes('travel') || norm.includes('heritage')) {
    return {
      category,
      rules: [
        'Follow Leave No Trace principles on Mt. Labo trails, rivers, falls, and coastlines—pack out all waste.',
        'Respect ancestral domains, private farms, and DENR watershed buffer zones; register with local guides.',
        'Share accurate harvest seasons, organic pest methods, and honest trail difficulty/weather advisories.',
        'Do not poach wild flora, orchids, or wildlife or reveal exact coordinates of sensitive nesting areas.',
        'Support local guides, porters, and smallholder farmers with fair compensation.',
      ],
      postingPolicy:
        'Trail conditions, sustainable farming practices, heritage documentation, and eco-responsible travel guides.',
      guidelinesSummary:
        'Stewardship & Leave-No-Trace Code: protect local watersheds, respect guides and farms, and share honest seasonal notes.',
    };
  }

  if (norm.includes('edu') || norm.includes('stem') || norm.includes('fitness') || norm.includes('sport')) {
    return {
      category,
      rules: [
        'Cite reliable learning sources and include beginner-friendly prerequisites for tutorials or workouts.',
        'No dangerous medical claims, unverified supplements, or shaming of beginners’ pace or skill level.',
        'Keep youth and student workshops inclusive, accessible, and safe for all learning levels.',
        'Share open notes, project schematics, or training logs cleanly for peer verification.',
        'Encourage consistency, injury-prevention warmups, and academic integrity.',
      ],
      postingPolicy:
        'Study guides, open workshops, safe training logs, and constructive peer mentoring.',
      guidelinesSummary:
        'Inclusive Learning & Wellness Standard: evidence-grounded advice, beginner hospitality, and safety-first habits.',
    };
  }

  return {
    category: category || (isGroup ? 'Community Circle' : 'Community Page'),
    rules: [
      `Keep posts, replies, and shared media relevant to ${category || 'this community'} and respectful to neighbors.`,
      'Zero hate speech, doxxing, harassment, or deceptive pyramid/crypto spam.',
      'Be honest and transparent when offering services, meetups, or collaborations.',
      'Credit collaborators, photographers, and sources whenever reposting third-party content.',
      isGroup
        ? 'Respect Circle privacy: never screenshot or leak Private Circle discussions outside this space.'
        : 'Follow Page moderators’ pinned advisories and tag topics clearly for easier discovery.',
    ],
    postingPolicy: isGroup
      ? 'Constructive peer discussions, local collaborations, and member-verified resources.'
      : 'Verified updates, helpful community guides, and respectful public conversation.',
    guidelinesSummary: isGroup
      ? 'Circle Trust Charter: mutual respect, confidentiality in private circles, and zero spam.'
      : 'Sphere Page Standards: accurate information, neighborly respect, and clear topic attribution.',
  };
}
