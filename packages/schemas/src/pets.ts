import * as z from "zod/v4";

export const PET_FRAME_WIDTH = 192;
export const PET_FRAME_HEIGHT = 208;
export const PET_SHEET_COLUMNS = 8;

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

export interface PetClip {
  name: PetClipName;
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

export interface PetSheetLayout {
  id: string;
  label: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  sheetWidth: number;
  sheetHeight: number;
  clips: Partial<Record<PetClipName, PetClip>>;
}

export const POLYCHAT_SHEET_LAYOUT_ID = "polychat-v1";
export const CODEX_SHEET_LAYOUT_ID = "codex-v1";

function layout(
  id: string,
  label: string,
  rows: number,
  clips: Partial<Record<PetClipName, PetClip>>,
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
  };
}

export const POLYCHAT_SHEET_LAYOUT = layout(POLYCHAT_SHEET_LAYOUT_ID, "Polychat", 11, PET_CLIPS);

export const CODEX_SHEET_LAYOUT = layout(CODEX_SHEET_LAYOUT_ID, "Codex", 9, {
  idle: { name: "idle", row: 0, frames: 6, fps: 4, loop: true },
  flit: { name: "flit", row: 1, frames: 8, fps: 15, loop: true },
  greet: { name: "greet", row: 3, frames: 4, fps: 8, loop: false },
  cheer: { name: "cheer", row: 4, frames: 5, fps: 12, loop: false },
  fret: { name: "fret", row: 5, frames: 8, fps: 10, loop: true },
  think: { name: "think", row: 6, frames: 6, fps: 7, loop: true },
  work: { name: "work", row: 7, frames: 6, fps: 14, loop: true },
  speak: { name: "speak", row: 8, frames: 6, fps: 11, loop: true },
});

export const PET_SHEET_LAYOUTS: readonly PetSheetLayout[] = [
  POLYCHAT_SHEET_LAYOUT,
  CODEX_SHEET_LAYOUT,
];

export const PET_SHEET_LAYOUT = POLYCHAT_SHEET_LAYOUT;

export function findPetSheetLayout(id: string | null | undefined): PetSheetLayout {
  return PET_SHEET_LAYOUTS.find((entry) => entry.id === id) ?? POLYCHAT_SHEET_LAYOUT;
}

export function matchPetSheetLayout(width: number, height: number): PetSheetLayout | undefined {
  return PET_SHEET_LAYOUTS.find(
    (entry) => entry.sheetWidth === width && entry.sheetHeight === height,
  );
}

export function describePetSheetSizes(): string {
  return PET_SHEET_LAYOUTS.map((entry) => `${entry.sheetWidth} by ${entry.sheetHeight}`).join(
    " or ",
  );
}

export const PET_IDLE_CLIP: PetClipName = "idle";

export const PET_IDLE_FLOURISH_CLIPS: readonly PetClipName[] = ["blink", "preen"];

export const petClipNameSchema = z.enum(PET_CLIP_NAMES);

export function resolvePetClip(name: PetClipName | string | null | undefined): PetClip {
  return PET_CLIPS[name as PetClipName] ?? PET_CLIPS[PET_IDLE_CLIP];
}

export function resolvePetClipIn(
  sheet: PetSheetLayout,
  name: PetClipName | string | null | undefined,
): PetClip {
  return sheet.clips[name as PetClipName] ?? sheet.clips[PET_IDLE_CLIP] ?? PET_CLIPS[PET_IDLE_CLIP];
}

export interface PetPreset {
  slug: string;
  label: string;
  description: string;
  sheetUrl: string;
}

export const PET_PRESETS: readonly PetPreset[] = [
  {
    slug: "pip",
    label: "Pip",
    description: "The house poly. Green, curious, slightly too pleased with itself.",
    sheetUrl: "/pets/pip.png",
  },
  {
    slug: "ash",
    label: "Ash",
    description: "Muted grey, no crest, no fuss. Moves less than the others and misses nothing.",
    sheetUrl: "/pets/ash.png",
  },
  {
    slug: "kea",
    label: "Kea",
    description: "Tropical blue with a red crest and no volume control.",
    sheetUrl: "/pets/kea.png",
  },
  {
    slug: "prism",
    label: "Prism",
    description:
      "Violet and faceted. Tilts rather than bobs, and maintains it is abstract, not confused.",
    sheetUrl: "/pets/prism.png",
  },
  {
    slug: "bit",
    label: "Bit",
    description: "A terminal with legs. Blinks in phosphor green and has opinions about fonts.",
    sheetUrl: "/pets/bit.png",
  },
  {
    slug: "sprocket",
    label: "Sprocket",
    description:
      "Brass and single-lensed, convinced everything would run better with one more gear.",
    sheetUrl: "/pets/sprocket.png",
  },
  {
    slug: "flask",
    label: "Flask",
    description: "Half full and quietly fizzing. Bobs when it gets excited, which is often.",
    sheetUrl: "/pets/flask.png",
  },
  {
    slug: "moss",
    label: "Moss",
    description: "A rock with a sprout and no urgency whatsoever. Moves when it feels like it.",
    sheetUrl: "/pets/moss.png",
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

export const userPetsResponseSchema = z.object({
  pets: z.array(userPetSchema),
  page: z.number().int().min(1),
  has_more: z.boolean(),
});

export const userPetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(PET_LIBRARY_PAGE_SIZE),
});

export const userPetResponseSchema = z.object({
  pet: userPetSchema,
});

export const generateUserPetSchema = z.object({
  name: z.string().trim().min(1).max(PET_NAME_MAX_LENGTH),
  description: z.string().trim().max(PET_DESCRIPTION_MAX_LENGTH).optional(),
  prompt: z.string().trim().min(1).max(PET_PROMPT_MAX_LENGTH),
});

export const petSelectionSchema = z.object({
  pet_source: petSourceSchema,
  pet_id: z.string().trim().min(1).max(PET_NAME_MAX_LENGTH),
});

const petModelSelectionMapSchema = z.record(z.string().trim().min(1).max(100), petSelectionSchema);

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
    families: petModelSelectionMapSchema.default({}),
    providers: petModelSelectionMapSchema.default({}),
  })
  .transform((overrides) => ({
    families: normalisePetModelSelectionMap(overrides.families),
    providers: normalisePetModelSelectionMap(overrides.providers),
  }));

export type PetSource = z.infer<typeof petSourceSchema>;
export type PetOrigin = z.infer<typeof petOriginSchema>;
export type UserPet = z.infer<typeof userPetSchema>;
export type UserPetsPage = z.infer<typeof userPetsResponseSchema>;
export type GenerateUserPetInput = z.infer<typeof generateUserPetSchema>;
export type PetSelection = z.infer<typeof petSelectionSchema>;
export type PetModelOverrides = z.infer<typeof petModelOverridesSchema>;

export const EMPTY_PET_MODEL_OVERRIDES: PetModelOverrides = {
  families: {},
  providers: {},
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

  return parsed.success ? parsed.data : { families: {}, providers: {} };
}

export function resolvePetSelectionForModel(
  selection: PetSelection,
  overrides: PetModelOverrides | null | undefined,
  model: { family?: string | null; provider?: string | null } | null | undefined,
): PetSelection {
  const family = normalisePetModelTarget(model?.family);
  const provider = normalisePetModelTarget(model?.provider);

  return (
    (family ? overrides?.families[family] : undefined) ??
    (provider ? overrides?.providers[provider] : undefined) ??
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
    families: Object.fromEntries(Object.entries(overrides.families).filter(keepSelection)),
    providers: Object.fromEntries(Object.entries(overrides.providers).filter(keepSelection)),
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
    layout: POLYCHAT_SHEET_LAYOUT,
  };
}

export function resolvePetForModel(
  selection: PetSelection,
  overrides: PetModelOverrides | null | undefined,
  model: { family?: string | null; provider?: string | null } | null | undefined,
  customPets: readonly UserPet[] = [],
): ResolvedPet {
  const modelSelection = resolvePetSelectionForModel(selection, overrides, model);
  const modelSelectionExists =
    (modelSelection.pet_source === "preset" && isPetPresetSlug(modelSelection.pet_id)) ||
    (modelSelection.pet_source === "custom" &&
      customPets.some((pet) => pet.id === modelSelection.pet_id));

  return resolvePet(modelSelectionExists ? modelSelection : selection, customPets);
}
