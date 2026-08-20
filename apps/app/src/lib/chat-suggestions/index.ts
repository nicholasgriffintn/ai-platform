import {
  buildConnectorSuggestions,
  buildRecipeSuggestions,
  CAPABILITY_SUGGESTIONS,
  EVERYDAY_SUGGESTIONS,
  FOCUS_SUGGESTIONS,
} from "./catalog";
import type {
  ChatSuggestion,
  ChatSuggestionContext,
  ChatSuggestionDefinition,
  ChatSuggestionTier,
} from "./types";

export const CHAT_SUGGESTION_COUNT = 4;

const MAX_PER_TIER: Record<ChatSuggestionTier, number> = {
  capability: 2,
  focus: 2,
  everyday: CHAT_SUGGESTION_COUNT,
};

const TIER_ORDER: ChatSuggestionTier[] = ["capability", "focus", "everyday"];

export interface CreateChatSuggestionsOptions {
  exclude?: ReadonlySet<string>;
  count?: number;
}

function createRandom(seed: number): () => number {
  let state = (Math.floor(boundSeed(seed) * 0xffffffff) + 0x6d2b79f5) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function boundSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.min(Math.max(seed, 0), 0.999999999) : 0;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));

    [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
  }

  return shuffled;
}

function buildTierPools(
  context: ChatSuggestionContext,
  random: () => number,
): Record<ChatSuggestionTier, ChatSuggestionDefinition[]> {
  const capability = [
    ...CAPABILITY_SUGGESTIONS.filter((suggestion) => suggestion.isEligible?.(context) !== false),
    ...buildConnectorSuggestions(context),
    ...buildRecipeSuggestions(context),
  ];

  return {
    capability: shuffle(capability, random),
    focus: shuffle(context.focusRole ? FOCUS_SUGGESTIONS[context.focusRole] : [], random),
    everyday: shuffle(EVERYDAY_SUGGESTIONS, random),
  };
}

function drain(
  pool: ChatSuggestionDefinition[],
  limit: number,
  taken: Set<string>,
  exclude: ReadonlySet<string>,
): ChatSuggestionDefinition[] {
  const available = pool.filter((suggestion) => !taken.has(suggestion.id));
  const ordered = [
    ...available.filter((suggestion) => !exclude.has(suggestion.id)),
    ...available.filter((suggestion) => exclude.has(suggestion.id)),
  ];
  const picked = ordered.slice(0, Math.max(limit, 0));

  for (const suggestion of picked) {
    taken.add(suggestion.id);
  }

  return picked;
}

function toSuggestion(
  definition: ChatSuggestionDefinition,
  tier: ChatSuggestionTier,
): ChatSuggestion {
  const { isEligible: _isEligible, ...rest } = definition;

  return { ...rest, tier };
}

export function createChatSuggestions(
  context: ChatSuggestionContext,
  seed: number,
  { exclude = new Set<string>(), count = CHAT_SUGGESTION_COUNT }: CreateChatSuggestionsOptions = {},
): ChatSuggestion[] {
  const random = createRandom(seed);
  const pools = buildTierPools(context, random);
  const taken = new Set<string>();
  const selected: ChatSuggestion[] = [];

  for (const tier of TIER_ORDER) {
    const remaining = count - selected.length;
    const limit = Math.min(MAX_PER_TIER[tier], remaining);

    selected.push(
      ...drain(pools[tier], limit, taken, exclude).map((definition) =>
        toSuggestion(definition, tier),
      ),
    );
  }

  for (const tier of TIER_ORDER) {
    if (selected.length >= count) {
      break;
    }

    selected.push(
      ...drain(pools[tier], count - selected.length, taken, exclude).map((definition) =>
        toSuggestion(definition, tier),
      ),
    );
  }

  return selected;
}

export * from "./types";
