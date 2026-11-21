import { ReactionTracker, ReactionType } from '../types/social';

export const REACTION_META: {
  type: ReactionType;
  emoji: string;
  label: string;
  colorClass: string;
}[] = [
  { type: 'heart', emoji: '❤️', label: 'Love', colorClass: 'text-rose-500' },
  { type: 'clap', emoji: '👏', label: 'Appreciate', colorClass: 'text-indigo-500' },
  { type: 'laugh', emoji: '😂', label: 'Haha', colorClass: 'text-amber-500' },
  { type: 'fire', emoji: '🔥', label: 'Fire', colorClass: 'text-orange-500' },
];

export const MAX_REACTION_SWITCHES = 3;
export const REACTION_COOLDOWN_MS = 700;
export const COMMENT_COOLDOWN_MS = 2000;

export function getReactionCounts(
  reactions?: Partial<Record<ReactionType, string[]>>,
  fallbackLikes?: string[]
): Record<ReactionType, number> {
  const base: Record<ReactionType, number> = {
    heart: reactions?.heart?.length ?? 0,
    clap: reactions?.clap?.length ?? 0,
    laugh: reactions?.laugh?.length ?? 0,
    fire: reactions?.fire?.length ?? 0,
  };
  if (
    !reactions &&
    fallbackLikes &&
    fallbackLikes.length > 0
  ) {
    base.heart = fallbackLikes.length;
  }
  return base;
}

export function getTotalReactions(
  reactions?: Partial<Record<ReactionType, string[]>>,
  fallbackLikes?: string[]
): number {
  const counts = getReactionCounts(reactions, fallbackLikes);
  return counts.heart + counts.clap + counts.laugh + counts.fire;
}

export function getUserActiveReaction(
  userId: string,
  reactions?: Partial<Record<ReactionType, string[]>>,
  tracker?: ReactionTracker,
  fallbackLikes?: string[]
): ReactionType | null {
  if (tracker?.userReactions?.[userId]) {
    return tracker.userReactions[userId];
  }
  if (reactions) {
    for (const meta of REACTION_META) {
      if (reactions[meta.type]?.includes(userId)) {
        return meta.type;
      }
    }
  }
  if (fallbackLikes?.includes(userId)) {
    return 'heart';
  }
  return null;
}

export function applyReactionRules(params: {
  userId: string;
  reactionType: ReactionType;
  reactions?: Partial<Record<ReactionType, string[]>>;
  tracker?: ReactionTracker;
  likes?: string[];
  now?: number;
}): {
  ok: boolean;
  error?: string;
  reactions: Partial<Record<ReactionType, string[]>>;
  tracker: ReactionTracker;
  likes: string[];
  switchesRemaining: number;
} {
  const now = params.now ?? Date.now();
  const reactions: Partial<Record<ReactionType, string[]>> = {
    heart: [...(params.reactions?.heart || [])],
    clap: [...(params.reactions?.clap || [])],
    laugh: [...(params.reactions?.laugh || [])],
    fire: [...(params.reactions?.fire || [])],
  };

  if (
    !params.reactions &&
    params.likes &&
    params.likes.length > 0
  ) {
    reactions.heart = [...params.likes];
  }

  const tracker: ReactionTracker = {
    userReactions: { ...(params.tracker?.userReactions || {}) },
    switchCounts: { ...(params.tracker?.switchCounts || {}) },
    lastReactedAt: { ...(params.tracker?.lastReactedAt || {}) },
  };

  // Sync existing reaction from arrays if tracker didn't record it yet
  if (!tracker.userReactions[params.userId]) {
    for (const meta of REACTION_META) {
      if (reactions[meta.type]?.includes(params.userId)) {
        tracker.userReactions[params.userId] = meta.type;
        break;
      }
    }
  }

  const lastAt = tracker.lastReactedAt?.[params.userId] || 0;
  if (now - lastAt < REACTION_COOLDOWN_MS) {
    return {
      ok: false,
      error: 'Please wait a moment before reacting again (anti-flood protection).',
      reactions,
      tracker,
      likes: reactions.heart || [],
      switchesRemaining: Math.max(0, MAX_REACTION_SWITCHES - (tracker.switchCounts[params.userId] || 0)),
    };
  }

  const currentReaction = tracker.userReactions[params.userId] || null;
  let switchesUsed = tracker.switchCounts[params.userId] || 0;

  if (currentReaction === params.reactionType) {
    // Clicking the same reaction toggles it off (does not consume a switch, just removes)
    reactions[params.reactionType] = (reactions[params.reactionType] || []).filter(
      (id) => id !== params.userId
    );
    delete tracker.userReactions[params.userId];
    tracker.lastReactedAt![params.userId] = now;
  } else {
    if (currentReaction !== null) {
      if (switchesUsed >= MAX_REACTION_SWITCHES) {
        return {
          ok: false,
          error: `Reaction limit reached: you can switch reactions up to ${MAX_REACTION_SWITCHES} times per item.`,
          reactions,
          tracker,
          likes: reactions.heart || [],
          switchesRemaining: 0,
        };
      }
      switchesUsed += 1;
      tracker.switchCounts[params.userId] = switchesUsed;
      // Remove previous single reaction
      reactions[currentReaction] = (reactions[currentReaction] || []).filter(
        (id) => id !== params.userId
      );
    }

    // Add new single reaction (guaranteeing no duplicates)
    for (const meta of REACTION_META) {
      reactions[meta.type] = (reactions[meta.type] || []).filter((id) => id !== params.userId);
    }
    reactions[params.reactionType] = [...(reactions[params.reactionType] || []), params.userId];
    tracker.userReactions[params.userId] = params.reactionType;
    tracker.lastReactedAt![params.userId] = now;
  }

  const allReactors = Array.from(
    new Set([
      ...(reactions.heart || []),
      ...(reactions.clap || []),
      ...(reactions.laugh || []),
      ...(reactions.fire || []),
    ])
  );

  return {
    ok: true,
    reactions,
    tracker,
    likes: allReactors,
    switchesRemaining: Math.max(0, MAX_REACTION_SWITCHES - switchesUsed),
  };
}
