import * as z from "zod/v4";

import { resolveModelMakerId } from "./model-makers.js";
import { listQuerySchema, listSchema } from "./platform/list.js";

export const PET_FRAME_WIDTH = 192;
export const PET_FRAME_HEIGHT = 208;
export const PET_SHEET_COLUMNS = 8;

export const PET_ASSET_BASE_URL = "https://assets.polychat.app/pets";

export function petPresetSheetUrl(slug: string): string {
  return `${PET_ASSET_BASE_URL}/${slug}.png`;
}

export function getPetSpriteHeight(
  size: number,
  frameLayout: { frameWidth: number; frameHeight: number } = {
    frameWidth: PET_FRAME_WIDTH,
    frameHeight: PET_FRAME_HEIGHT,
  },
): number {
  return (frameLayout.frameHeight * size) / frameLayout.frameWidth;
}

export const PET_CLIP_NAMES = [
  "idle",
  "blink",
  "preen",
  "greet",
  "think",
  "work",
  "speak",
  "cheer",
  "fret",
  "doze",
  "flit",
] as const;

export type PetClipName = (typeof PET_CLIP_NAMES)[number];

export const PET_EXTRA_STATE_NAMES = ["wait", "acknowledge", "listen", "review"] as const;

export type PetExtraStateName = (typeof PET_EXTRA_STATE_NAMES)[number];

export const PET_STATE_NAMES = [...PET_CLIP_NAMES, ...PET_EXTRA_STATE_NAMES] as const;

export type PetStateName = (typeof PET_STATE_NAMES)[number];

export const PET_STATE_FALLBACKS: Record<PetExtraStateName, PetClipName> = {
  wait: "idle",
  acknowledge: "greet",
  listen: "think",
  review: "think",
};

export interface PetClip {
  name: PetStateName;
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export const PET_CLIPS: Record<PetClipName, PetClip> = {
  idle: { name: "idle", row: 0, frames: 8, fps: 4, loop: true },
  blink: { name: "blink", row: 1, frames: 4, fps: 14, loop: false },
  preen: { name: "preen", row: 2, frames: 6, fps: 8, loop: false },
  greet: { name: "greet", row: 3, frames: 4, fps: 8, loop: false },
  think: { name: "think", row: 4, frames: 6, fps: 7, loop: true },
  work: { name: "work", row: 5, frames: 8, fps: 14, loop: true },
  speak: { name: "speak", row: 6, frames: 6, fps: 11, loop: true },
  cheer: { name: "cheer", row: 7, frames: 6, fps: 12, loop: false },
  fret: { name: "fret", row: 8, frames: 8, fps: 10, loop: true },
  doze: { name: "doze", row: 9, frames: 4, fps: 3, loop: true },
  flit: { name: "flit", row: 10, frames: 8, fps: 15, loop: true },
};

export const PET_LOOK_DIRECTIONS = 16;

export interface PetSheetLayout {
  id: string;
  label: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  sheetWidth: number;
  sheetHeight: number;
  clips: Partial<Record<PetStateName, PetClip>>;
  lookRow: number | null;
}

export const POLYCHAT_SHEET_LAYOUT_ID = "polychat-v1";
export const CODEX_SHEET_LAYOUT_ID = "codex-v1";
export const CODEX_V2_SHEET_LAYOUT_ID = "codex-v2";

function layout(
  id: string,
  label: string,
  rows: number,
  clips: Partial<Record<PetStateName, PetClip>>,
  lookRow: number | null = null,
): PetSheetLayout {
  return {
    id,
    label,
    frameWidth: PET_FRAME_WIDTH,
    frameHeight: PET_FRAME_HEIGHT,
    columns: PET_SHEET_COLUMNS,
    rows,
    sheetWidth: PET_FRAME_WIDTH * PET_SHEET_COLUMNS,
    sheetHeight: PET_FRAME_HEIGHT * rows,
    clips,
    lookRow,
  };
}

export const POLYCHAT_SHEET_LAYOUT = layout(POLYCHAT_SHEET_LAYOUT_ID, "Polychat", 11, PET_CLIPS);

const CODEX_CLIPS: Partial<Record<PetStateName, PetClip>> = {
  idle: { name: "idle", row: 0, frames: 6, fps: 4, loop: true },
  flit: { name: "flit", row: 1, frames: 8, fps: 15, loop: true },
  greet: { name: "greet", row: 3, frames: 4, fps: 8, loop: false },
  acknowledge: { name: "acknowledge", row: 3, frames: 4, fps: 8, loop: false },
  cheer: { name: "cheer", row: 4, frames: 5, fps: 12, loop: false },
  fret: { name: "fret", row: 5, frames: 8, fps: 10, loop: true },
  think: { name: "think", row: 6, frames: 6, fps: 7, loop: true },
  wait: { name: "wait", row: 6, frames: 6, fps: 5, loop: true },
  work: { name: "work", row: 7, frames: 6, fps: 14, loop: true },
  speak: { name: "speak", row: 8, frames: 6, fps: 11, loop: true },
  review: { name: "review", row: 8, frames: 6, fps: 8, loop: true },
};

export const CODEX_SHEET_LAYOUT = layout(CODEX_SHEET_LAYOUT_ID, "Codex", 9, CODEX_CLIPS);

export const CODEX_V2_SHEET_LAYOUT = layout(
  CODEX_V2_SHEET_LAYOUT_ID,
  "Codex with look directions",
  11,
  CODEX_CLIPS,
  9,
);

export const PET_SHEET_LAYOUTS: readonly PetSheetLayout[] = [
  POLYCHAT_SHEET_LAYOUT,
  CODEX_SHEET_LAYOUT,
  CODEX_V2_SHEET_LAYOUT,
];

export const PET_SHEET_LAYOUT = POLYCHAT_SHEET_LAYOUT;

export function findPetSheetLayout(id: string | null | undefined): PetSheetLayout {
  return PET_SHEET_LAYOUTS.find((entry) => entry.id === id) ?? POLYCHAT_SHEET_LAYOUT;
}

export function isPetSheetLayoutId(value: unknown): value is string {
  return typeof value === "string" && PET_SHEET_LAYOUTS.some((entry) => entry.id === value);
}

export function matchPetSheetLayouts(width: number, height: number): PetSheetLayout[] {
  return PET_SHEET_LAYOUTS.filter(
    (entry) => entry.sheetWidth === width && entry.sheetHeight === height,
  );
}

export type PetSheetLayoutSelection =
  | { kind: "selected"; layout: PetSheetLayout }
  | { kind: "unknown-size" }
  | { kind: "ambiguous"; candidates: PetSheetLayout[] }
  | { kind: "mismatch"; candidates: PetSheetLayout[] };

export function selectPetSheetLayout(
  width: number,
  height: number,
  requestedId?: string | null,
): PetSheetLayoutSelection {
  const candidates = matchPetSheetLayouts(width, height);

  if (candidates.length === 0) {
    return { kind: "unknown-size" };
  }

  if (requestedId) {
    const requested = candidates.find((entry) => entry.id === requestedId);

    return requested ? { kind: "selected", layout: requested } : { kind: "mismatch", candidates };
  }

  if (candidates.length > 1) {
    return { kind: "ambiguous", candidates };
  }

  return { kind: "selected", layout: candidates[0] };
}

export function describePetSheetSizes(): string {
  const sizes = new Set(
    PET_SHEET_LAYOUTS.map((entry) => `${entry.sheetWidth} by ${entry.sheetHeight}`),
  );

  return [...sizes].join(" or ");
}

export const petManifestSchema = z.object({
  id: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  description: z.string().optional(),
  spriteVersionNumber: z.union([z.literal(1), z.literal(2)]).default(1),
  spritesheetPath: z.string().trim().min(1).optional(),
  layoutId: z.string().trim().min(1).optional(),
});

export const PET_MANIFEST_DEFAULT_SHEET_PATH = "spritesheet.webp";
export const PET_MANIFEST_MAX_BYTES = 64 * 1024;

export const importPetSchema = z.object({
  url: z.url().max(2048).describe("Address of a Codex or Polychat pet.json manifest"),
});

export type ImportPetInput = z.infer<typeof importPetSchema>;

export type PetManifest = z.infer<typeof petManifestSchema>;

export function petLayoutIdForManifest(
  manifest: Pick<PetManifest, "spriteVersionNumber" | "layoutId">,
): string {
  if (manifest.layoutId && PET_SHEET_LAYOUTS.some((entry) => entry.id === manifest.layoutId)) {
    return manifest.layoutId;
  }

  return manifest.spriteVersionNumber === 2 ? CODEX_V2_SHEET_LAYOUT_ID : CODEX_SHEET_LAYOUT_ID;
}

export function buildPetManifest(pet: {
  id: string;
  name: string;
  description: string | null;
  layoutId: string;
}): PetManifest {
  const codexVersion =
    pet.layoutId === CODEX_V2_SHEET_LAYOUT_ID
      ? 2
      : pet.layoutId === CODEX_SHEET_LAYOUT_ID
        ? 1
        : null;

  return {
    id: pet.id,
    displayName: pet.name,
    ...(pet.description ? { description: pet.description } : {}),
    spriteVersionNumber: codexVersion ?? 1,
    spritesheetPath: PET_MANIFEST_DEFAULT_SHEET_PATH,
    layoutId: pet.layoutId,
  };
}

export interface PetLookFrame {
  row: number;
  column: number;
}

export function resolvePetLook(
  sheet: PetSheetLayout,
  angleDegrees: number | null | undefined,
): PetLookFrame | null {
  if (sheet.lookRow === null || angleDegrees === null || angleDegrees === undefined) {
    return null;
  }

  const step = 360 / PET_LOOK_DIRECTIONS;
  const normalised = ((angleDegrees % 360) + 360) % 360;
  const index = Math.round(normalised / step) % PET_LOOK_DIRECTIONS;

  return {
    row: sheet.lookRow + Math.floor(index / sheet.columns),
    column: index % sheet.columns,
  };
}

export const PET_IDLE_CLIP: PetClipName = "idle";

export const PET_IDLE_FLOURISH_CLIPS: readonly PetClipName[] = ["blink", "preen"];

export const petClipNameSchema = z.enum(PET_CLIP_NAMES);

export const petStateNameSchema = z.enum(PET_STATE_NAMES);

function isPetStateName(name: string | null | undefined): name is PetStateName {
  return typeof name === "string" && (PET_STATE_NAMES as readonly string[]).includes(name);
}

function isPetExtraStateName(name: PetStateName): name is PetExtraStateName {
  return (PET_EXTRA_STATE_NAMES as readonly string[]).includes(name);
}

export function resolvePetClip(name: string | null | undefined): PetClip {
  return resolvePetClipIn(POLYCHAT_SHEET_LAYOUT, name);
}

export function resolvePetClipIn(sheet: PetSheetLayout, name: string | null | undefined): PetClip {
  const idle = sheet.clips[PET_IDLE_CLIP] ?? PET_CLIPS[PET_IDLE_CLIP];

  if (!isPetStateName(name)) {
    return idle;
  }

  const direct = sheet.clips[name];

  if (direct) {
    return direct;
  }

  if (isPetExtraStateName(name)) {
    return sheet.clips[PET_STATE_FALLBACKS[name]] ?? idle;
  }

  return idle;
}

export interface PetPreset {
  slug: string;
  label: string;
  description: string;
  sheetUrl: string;
  layoutId?: string;
}

export const PET_PRESETS: readonly PetPreset[] = [
  {
    slug: "pip",
    label: "Pip",
    description: "The house poly. Green, curious, slightly too pleased with itself.",
    sheetUrl: `${PET_ASSET_BASE_URL}/pip.png`,
  },
  {
    slug: "ash",
    label: "Ash",
    description: "Muted grey, no crest, no fuss. Moves less than the others and misses nothing.",
    sheetUrl: `${PET_ASSET_BASE_URL}/ash.png`,
  },
  {
    slug: "kea",
    label: "Kea",
    description: "Tropical blue with a red crest and no volume control.",
    sheetUrl: `${PET_ASSET_BASE_URL}/kea.png`,
  },
  {
    slug: "prism",
    label: "Prism",
    description:
      "Violet and faceted. Tilts rather than bobs, and maintains it is abstract, not confused.",
    sheetUrl: `${PET_ASSET_BASE_URL}/prism.png`,
  },
  {
    slug: "bit",
    label: "Bit",
    description: "A terminal with legs. Blinks in phosphor green and has opinions about fonts.",
    sheetUrl: `${PET_ASSET_BASE_URL}/bit.png`,
  },
  {
    slug: "sprocket",
    label: "Sprocket",
    description:
      "Brass and single-lensed, convinced everything would run better with one more gear.",
    sheetUrl: `${PET_ASSET_BASE_URL}/sprocket.png`,
  },
  {
    slug: "flask",
    label: "Flask",
    description: "Half full and quietly fizzing. Bobs when it gets excited, which is often.",
    sheetUrl: `${PET_ASSET_BASE_URL}/flask.png`,
  },
  {
    slug: "moss",
    label: "Moss",
    description: "A rock with a sprout and no urgency whatsoever. Moves when it feels like it.",
    sheetUrl: `${PET_ASSET_BASE_URL}/moss.png`,
  },
  {
    slug: "wisp",
    label: "Wisp",
    description: "Present, briefly. Remembers nothing and is at peace with it.",
    sheetUrl: `${PET_ASSET_BASE_URL}/wisp.png`,
  },
];

export const DEFAULT_PET_PRESET_SLUG = "pip";

export const PET_PRESET_SLUGS = PET_PRESETS.map((preset) => preset.slug);

export function isPetPresetSlug(value: unknown): value is string {
  return typeof value === "string" && PET_PRESET_SLUGS.includes(value);
}

export function resolvePetPreset(slug: string | null | undefined): PetPreset {
  return (
    PET_PRESETS.find((preset) => preset.slug === slug) ??
    PET_PRESETS.find((preset) => preset.slug === DEFAULT_PET_PRESET_SLUG) ??
    PET_PRESETS[0]
  );
}

export const PET_NAME_MAX_LENGTH = 60;
export const PET_DESCRIPTION_MAX_LENGTH = 500;
export const PET_PROMPT_MAX_LENGTH = 500;
export const PET_SHEET_MAX_BYTES = 20 * 1024 * 1024;
export const PET_LIBRARY_PAGE_SIZE = 8;

export const PET_SHEET_MIME_TYPES = ["image/png", "image/webp"] as const;

export const petSourceSchema = z.enum(["preset", "custom"]);
export const petOriginSchema = z.enum(["upload", "generated"]);

export const userPetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(PET_NAME_MAX_LENGTH),
  description: z.string().max(PET_DESCRIPTION_MAX_LENGTH).nullable(),
  origin: petOriginSchema,
  sheet_url: z.string().min(1),
  layout_id: z.string().min(1),
  prompt: z.string().nullable(),
  created_at: z.string(),
});

export const userPetsResponseSchema = listSchema(userPetSchema);

export const userPetsQuerySchema = listQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(PET_LIBRARY_PAGE_SIZE),
});

export const generateUserPetSchema = z.object({
  name: z.string().trim().min(1).max(PET_NAME_MAX_LENGTH),
  description: z.string().trim().max(PET_DESCRIPTION_MAX_LENGTH).optional(),
  prompt: z.string().trim().min(1).max(PET_PROMPT_MAX_LENGTH),
});

export const PET_POSE_CLIPS = ["greet", "think", "work", "speak", "cheer", "fret", "doze"] as const;

export type PetPoseClip = (typeof PET_POSE_CLIPS)[number];

export const generatedPetImageSchema = z.object({
  image: z.string(),
  seed: z.number().int().nonnegative(),
});

export const generatePetPosesSchema = z.object({
  prompt: z.string().trim().min(1).max(PET_PROMPT_MAX_LENGTH),
  seed: z.number().int().nonnegative(),
});

export const generatedPetPosesSchema = z.object({
  poses: z.partialRecord(z.enum(PET_POSE_CLIPS), z.string()),
});

export type GeneratedPetImage = z.infer<typeof generatedPetImageSchema>;
export type GeneratePetPosesInput = z.infer<typeof generatePetPosesSchema>;
export type GeneratedPetPoses = z.infer<typeof generatedPetPosesSchema>;

export const petSelectionSchema = z.object({
  pet_source: petSourceSchema,
  pet_id: z.string().trim().min(1).max(PET_NAME_MAX_LENGTH),
});

const petModelSelectionMapSchema = z.record(z.string().trim().min(1).max(100), petSelectionSchema);

export const PET_TEMPORARY_CONVERSATION_STATE = "temporary" as const;

export type PetConversationState = typeof PET_TEMPORARY_CONVERSATION_STATE;

function normalisePetModelSelectionMap(
  selections: Record<string, PetSelection>,
): Record<string, PetSelection> {
  return Object.fromEntries(
    Object.entries(selections).map(([target, selection]) => [
      target.trim().toLowerCase(),
      selection,
    ]),
  );
}

export const petModelOverridesSchema = z
  .object({
    states: petModelSelectionMapSchema.default({}),
    families: petModelSelectionMapSchema.default({}),
    providers: petModelSelectionMapSchema.default({}),
    makers: petModelSelectionMapSchema.default({}),
  })
  .transform((overrides) => ({
    states: normalisePetModelSelectionMap(overrides.states),
    families: normalisePetModelSelectionMap(overrides.families),
    providers: normalisePetModelSelectionMap(overrides.providers),
    makers: normalisePetModelSelectionMap(overrides.makers),
  }));

export type PetSource = z.infer<typeof petSourceSchema>;
export type PetOrigin = z.infer<typeof petOriginSchema>;
export type UserPet = z.infer<typeof userPetSchema>;
export type UserPetsPage = z.infer<typeof userPetsResponseSchema>;
export type GenerateUserPetInput = z.infer<typeof generateUserPetSchema>;
export type PetSelection = z.infer<typeof petSelectionSchema>;
export type PetModelOverrides = z.infer<typeof petModelOverridesSchema>;
export type StoredPetModelOverrides = z.input<typeof petModelOverridesSchema>;

export const EMPTY_PET_MODEL_OVERRIDES: PetModelOverrides = {
  states: {},
  families: {},
  providers: {},
  makers: {},
};

export interface ResolvedPet {
  source: PetSource;
  id: string;
  name: string;
  sheetUrl: string;
  layout: PetSheetLayout;
}

function normalisePetModelTarget(value: string | null | undefined): string | undefined {
  const normalised = value?.trim().toLowerCase();

  return normalised || undefined;
}

export function parsePetModelOverrides(value: unknown): PetModelOverrides {
  const parsed = petModelOverridesSchema.safeParse(value);

  return parsed.success ? parsed.data : { states: {}, families: {}, providers: {}, makers: {} };
}

const TEMPORARY_PET_SELECTION: PetSelection = {
  pet_source: "preset",
  pet_id: "wisp",
};

function selectionForConversationState(
  overrides: PetModelOverrides | null | undefined,
  conversationState: string | null | undefined,
): PetSelection | undefined {
  const state = normalisePetModelTarget(conversationState);

  return state ? overrides?.states[state] : undefined;
}

export function resolvePetSelectionForModel(
  selection: PetSelection,
  overrides: PetModelOverrides | null | undefined,
  model: { family?: string | null; provider?: string | null } | null | undefined,
  conversationState?: string | null,
): PetSelection {
  const state = normalisePetModelTarget(conversationState);
  const stateSelection = selectionForConversationState(overrides, conversationState);

  if (stateSelection) {
    return stateSelection;
  }

  if (state === PET_TEMPORARY_CONVERSATION_STATE) {
    return TEMPORARY_PET_SELECTION;
  }

  const family = normalisePetModelTarget(model?.family);
  const provider = normalisePetModelTarget(model?.provider);
  const maker = resolveModelMakerId(model);

  return (
    (family ? overrides?.families[family] : undefined) ??
    (provider ? overrides?.providers[provider] : undefined) ??
    (maker ? overrides?.makers[maker] : undefined) ??
    selection
  );
}

export function removeCustomPetFromModelOverrides(
  overrides: PetModelOverrides,
  petId: string,
): PetModelOverrides {
  const keepSelection = ([, selection]: [string, PetSelection]) =>
    selection.pet_source !== "custom" || selection.pet_id !== petId;

  return {
    states: Object.fromEntries(Object.entries(overrides.states).filter(keepSelection)),
    families: Object.fromEntries(Object.entries(overrides.families).filter(keepSelection)),
    providers: Object.fromEntries(Object.entries(overrides.providers).filter(keepSelection)),
    makers: Object.fromEntries(Object.entries(overrides.makers).filter(keepSelection)),
  };
}

export function resolvePet(
  selection: { pet_source?: string | null; pet_id?: string | null } | null | undefined,
  customPets: readonly UserPet[] = [],
): ResolvedPet {
  if (selection?.pet_source === "custom" && selection.pet_id) {
    const custom = customPets.find((pet) => pet.id === selection.pet_id);

    if (custom) {
      return {
        source: "custom",
        id: custom.id,
        name: custom.name,
        sheetUrl: custom.sheet_url,
        layout: findPetSheetLayout(custom.layout_id),
      };
    }
  }

  const preset = resolvePetPreset(selection?.pet_id);

  return {
    source: "preset",
    id: preset.slug,
    name: preset.label,
    sheetUrl: preset.sheetUrl,
    layout: findPetSheetLayout(preset.layoutId),
  };
}

export function resolvePetForModel(
  selection: PetSelection,
  overrides: PetModelOverrides | null | undefined,
  model: { family?: string | null; provider?: string | null } | null | undefined,
  customPets?: readonly UserPet[],
): ResolvedPet;
export function resolvePetForModel(
  selection: PetSelection,
  overrides: PetModelOverrides | null | undefined,
  model: { family?: string | null; provider?: string | null } | null | undefined,
  conversationState?: string | null,
  customPets?: readonly UserPet[],
): ResolvedPet;
export function resolvePetForModel(
  selection: PetSelection,
  overrides: PetModelOverrides | null | undefined,
  model: { family?: string | null; provider?: string | null } | null | undefined,
  conversationStateOrCustomPets?: string | null | readonly UserPet[],
  customPetsOrConversationState?: readonly UserPet[] | string | null,
): ResolvedPet {
  const hasCustomPets = isUserPetList(conversationStateOrCustomPets);
  const customPets = hasCustomPets
    ? conversationStateOrCustomPets
    : isUserPetList(customPetsOrConversationState)
      ? customPetsOrConversationState
      : [];
  const conversationState = hasCustomPets
    ? typeof customPetsOrConversationState === "string" || customPetsOrConversationState === null
      ? customPetsOrConversationState
      : undefined
    : typeof conversationStateOrCustomPets === "string" || conversationStateOrCustomPets === null
      ? conversationStateOrCustomPets
      : undefined;
  const state = normalisePetModelTarget(conversationState);
  const fallbackSelection =
    state === PET_TEMPORARY_CONVERSATION_STATE ? TEMPORARY_PET_SELECTION : selection;
  const modelSelection = resolvePetSelectionForModel(fallbackSelection, overrides, model, state);
  const modelSelectionExists =
    (modelSelection.pet_source === "preset" && isPetPresetSlug(modelSelection.pet_id)) ||
    (modelSelection.pet_source === "custom" &&
      customPets.some((pet) => pet.id === modelSelection.pet_id));

  return resolvePet(modelSelectionExists ? modelSelection : fallbackSelection, customPets);
}

function isUserPetList(
  value: string | null | readonly UserPet[] | undefined,
): value is readonly UserPet[] {
  return Array.isArray(value);
}
