import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  DEFAULT_PET_PRESET_SLUG,
  PET_DESCRIPTION_MAX_LENGTH,
  PET_NAME_MAX_LENGTH,
  PET_SHEET_MAX_BYTES,
  PET_SHEET_MIME_TYPES,
  describePetSheetSizes,
  mapListPage,
  selectPetSheetLayout,
  parsePetModelOverrides,
  removeCustomPetFromModelOverrides,
  toListPage,
  type ListQuery,
  type PetOrigin,
  type PetSheetLayout,
  type UserPet,
  type UserPetsPage,
  PET_MANIFEST_DEFAULT_SHEET_PATH,
  PET_MANIFEST_MAX_BYTES,
  PET_POSE_CLIPS,
  petLayoutIdForManifest,
  petManifestSchema,
  type ImportPetInput,
  type GeneratedPetImage,
  type GeneratedPetPoses,
  type GeneratePetPosesInput,
  type PetPoseClip,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, readImageDimensions } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  fetchFollowingSafeRedirects,
  readResponseBytesWithinLimit,
  UnsafeUrlError,
} from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import * as z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { generateImage } from "~/modules/generate/application/image";
import type { UserPetRecord } from "~/modules/pets/infrastructure/UserPetRepository";
import { UserPetRepository } from "~/modules/pets/infrastructure/UserPetRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IUser } from "~/types";

const logger = getLogger({ prefix: "services/pets" });

const PET_IMPORT_TIMEOUT_MS = 15_000;

const storedImageSchema = z.object({
  key: z.string().min(1),
  seed: z.number().int().nonnegative(),
});

function assertPetAuthoring(user: IUser): void {
  if (!hasProEntitlement(user)) {
    throw new AssistantError(
      "Uploading and generating pets requires a Pro plan",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

function buildSheetUrl(context: ServiceContext, petId: string): string {
  const baseUrl = context.env.API_BASE_URL?.replace(/\/$/, "");
  const path = `/pets/${petId}/sheet`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

function toUserPet(context: ServiceContext, record: UserPetRecord): UserPet {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    origin: record.origin,
    sheet_url: buildSheetUrl(context, record.id),
    layout_id: record.layout_id,
    prompt: record.prompt,
    created_at: record.created_at,
  };
}

function readRequiredText(formData: FormData, field: string, maxLength: number): string {
  const value = formData.get(field);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AssistantError(`${field} is required`, ErrorType.PARAMS_ERROR, 400);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new AssistantError(
      `${field} must be ${maxLength} characters or fewer`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return trimmed;
}

function readOptionalText(
  formData: FormData,
  field: string,
  maxLength: number,
): string | undefined {
  const value = formData.get(field);

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new AssistantError(
      `${field} must be ${maxLength} characters or fewer`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return trimmed;
}

function describeLayouts(layouts: readonly PetSheetLayout[]): string {
  return layouts.map((entry) => `${entry.label} (${entry.id})`).join(" or ");
}

function assertSheetIsValid(
  bytes: Uint8Array,
  requestedLayoutId: string | undefined,
): {
  mimeType: "image/png" | "image/webp";
  layout: PetSheetLayout;
} {
  const dimensions = readImageDimensions(bytes);

  if (!dimensions) {
    throw new AssistantError("The sheet must be a PNG or WebP image", ErrorType.PARAMS_ERROR, 400);
  }

  const selection = selectPetSheetLayout(dimensions.width, dimensions.height, requestedLayoutId);

  if (selection.kind === "unknown-size") {
    throw new AssistantError(
      `The sheet must be ${describePetSheetSizes()} pixels, not ${dimensions.width} by ${dimensions.height}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (selection.kind === "ambiguous") {
    throw new AssistantError(
      `A ${dimensions.width} by ${dimensions.height} sheet could be ${describeLayouts(selection.candidates)}. Choose its layout.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (selection.kind === "mismatch") {
    throw new AssistantError(
      `A ${dimensions.width} by ${dimensions.height} sheet must use ${describeLayouts(selection.candidates)}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    mimeType: dimensions.format === "png" ? "image/png" : "image/webp",
    layout: selection.layout,
  };
}

export async function listPets(context: ServiceContext, query: ListQuery): Promise<UserPetsPage> {
  const user = context.requireUser();
  const records = await context.repositories
    .get(UserPetRepository)
    .listUserPets(user.id, query.limit + 1, query.after);

  return mapListPage(
    toListPage(records, query.limit, (record) => record.id),
    (record) => toUserPet(context, record),
  );
}

export async function getPet(context: ServiceContext, petId: string): Promise<UserPet> {
  const user = context.requireUser();
  const record = await context.repositories.get(UserPetRepository).getUserPet(user.id, petId);

  if (!record) {
    throw new AssistantError("Pet not found", ErrorType.NOT_FOUND, 404);
  }

  return toUserPet(context, record);
}

export async function createPet(context: ServiceContext, formData: FormData): Promise<UserPet> {
  const user = context.requireUser();

  assertPetAuthoring(user);

  const name = readRequiredText(formData, "name", PET_NAME_MAX_LENGTH);
  const description = readOptionalText(formData, "description", PET_DESCRIPTION_MAX_LENGTH);
  const prompt = readOptionalText(formData, "prompt", PET_DESCRIPTION_MAX_LENGTH);
  const layoutId = readOptionalText(formData, "layout_id", PET_NAME_MAX_LENGTH);
  const originValue = formData.get("origin");
  const origin: PetOrigin = originValue === "generated" ? "generated" : "upload";

  const sheet = formData.get("sheet");

  if (!(sheet instanceof File)) {
    throw new AssistantError("A sprite sheet is required", ErrorType.PARAMS_ERROR, 400);
  }

  if (sheet.size > PET_SHEET_MAX_BYTES) {
    throw new AssistantError(
      `The sheet must be ${Math.round(PET_SHEET_MAX_BYTES / 1024 / 1024)} MiB or smaller`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return storePetSheet(context, user, {
    name,
    description: description ?? null,
    prompt: prompt ?? null,
    origin,
    layoutId,
    bytes: new Uint8Array(await sheet.arrayBuffer()),
  });
}

async function storePetSheet(
  context: ServiceContext,
  user: IUser,
  input: {
    name: string;
    description: string | null;
    prompt: string | null;
    origin: PetOrigin;
    layoutId: string | undefined;
    bytes: Uint8Array;
  },
): Promise<UserPet> {
  const { mimeType, layout } = assertSheetIsValid(input.bytes, input.layoutId);

  if (!PET_SHEET_MIME_TYPES.includes(mimeType)) {
    throw new AssistantError("Unsupported sheet format", ErrorType.PARAMS_ERROR, 400);
  }

  const storage = StorageService.forPrivateAssets(context);
  const extension = mimeType === "image/png" ? "png" : "webp";
  const sheetKey = `pets/${user.id}/${generateId()}.${extension}`;

  await storage.uploadObject(sheetKey, input.bytes, {
    httpMetadata: { contentType: mimeType },
  });

  const record = await context.repositories.get(UserPetRepository).createUserPet({
    userId: user.id,
    name: input.name,
    description: input.description,
    origin: input.origin,
    sheetKey,
    layoutId: layout.id,
    prompt: input.prompt,
  });

  return toUserPet(context, record);
}

async function fetchPublicBytes(url: URL, maxBytes: number, what: string): Promise<Uint8Array> {
  let response: Response;

  try {
    response = await fetchFollowingSafeRedirects(url, {
      signal: AbortSignal.timeout(PET_IMPORT_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AssistantError(
      error instanceof UnsafeUrlError
        ? `The ${what} must be on a public web address`
        : `The ${what} could not be fetched`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `The ${what} returned ${response.status}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  try {
    return await readResponseBytesWithinLimit(response, maxBytes);
  } catch {
    throw new AssistantError(`The ${what} is too large`, ErrorType.PARAMS_ERROR, 400);
  }
}

export async function importPet(context: ServiceContext, input: ImportPetInput): Promise<UserPet> {
  const user = context.requireUser();

  assertPetAuthoring(user);

  const manifestUrl = new URL(input.url);
  const manifestBytes = await fetchPublicBytes(manifestUrl, PET_MANIFEST_MAX_BYTES, "pet.json");
  const manifest = petManifestSchema.safeParse(
    safeParseJson(new TextDecoder().decode(manifestBytes)),
  );

  if (!manifest.success) {
    throw new AssistantError(
      "That address does not hold a pet.json manifest",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const sheetUrl = new URL(
    manifest.data.spritesheetPath ?? PET_MANIFEST_DEFAULT_SHEET_PATH,
    manifestUrl,
  );

  return storePetSheet(context, user, {
    name: manifest.data.displayName.slice(0, PET_NAME_MAX_LENGTH),
    description: manifest.data.description?.slice(0, PET_DESCRIPTION_MAX_LENGTH) ?? null,
    prompt: null,
    origin: "upload",
    layoutId: petLayoutIdForManifest(manifest.data),
    bytes: await fetchPublicBytes(sheetUrl, PET_SHEET_MAX_BYTES, "sprite sheet"),
  });
}

export async function deletePet(context: ServiceContext, petId: string): Promise<void> {
  const user = context.requireUser();
  const record = await context.repositories.get(UserPetRepository).getUserPet(user.id, petId);

  if (!record) {
    throw new AssistantError("Pet not found", ErrorType.NOT_FOUND, 404);
  }

  const settings = await context.repositories.get(UserSettingsRepository).getUserSettings(user.id);

  if (settings) {
    const overrides = parsePetModelOverrides(settings.pet_model_overrides);
    const update: Record<string, unknown> = {
      pet_model_overrides: removeCustomPetFromModelOverrides(overrides, petId),
    };

    if (settings.pet_source === "custom" && settings.pet_id === petId) {
      Object.assign(update, {
        pet_source: "preset",
        pet_id: DEFAULT_PET_PRESET_SLUG,
      });
    }

    await context.repositories.get(UserSettingsRepository).updateUserSettings(user.id, update);
  }

  await context.repositories.get(UserPetRepository).deleteUserPet(user.id, petId);

  const storage = StorageService.forPrivateAssets(context);

  try {
    await storage.deleteObject(record.sheet_key);
  } catch (error) {
    logger.warn("Failed to delete a pet sprite sheet after removing its database record", {
      userId: user.id,
      petId,
      sheetKey: record.sheet_key,
      error,
    });
  }
}

export async function readPetSheet(
  context: ServiceContext,
  petId: string,
): Promise<{ data: ArrayBuffer; contentType: string; etag: string }> {
  const user = context.requireUser();
  const record = await context.repositories.get(UserPetRepository).getUserPet(user.id, petId);

  if (!record) {
    throw new AssistantError("Pet not found", ErrorType.NOT_FOUND, 404);
  }

  const storage = StorageService.forPrivateAssets(context);
  const object = await storage.getObjectBody(record.sheet_key);

  if (!object) {
    throw new AssistantError("Pet sheet not found", ErrorType.NOT_FOUND, 404);
  }

  return {
    data: await object.arrayBuffer(),
    contentType: record.sheet_key.endsWith(".png") ? "image/png" : "image/webp",
    etag: `W/"${record.sheet_key}-${record.layout_id}"`,
  };
}

const PET_POSE_PHRASES: Readonly<Record<PetPoseClip, string>> = {
  greet: "waving hello with one arm raised",
  think: "head tilted, looking up, thinking hard",
  work: "leaning forward, focused and busy",
  speak: "mouth open mid-sentence, talking",
  cheer: "both arms up, delighted",
  fret: "worried and flustered, eyebrows raised",
  doze: "eyes closed, peacefully asleep",
};

function petPrompt(prompt: string, pose?: PetPoseClip): string {
  const base = `${getPromptText("apps/pets/style")} The character is: ${prompt}`;

  return pose
    ? `${base} Same character, same colours and outfit. Pose: ${PET_POSE_PHRASES[pose]}.`
    : base;
}

async function drawPetImage(
  context: ServiceContext,
  user: IUser,
  prompt: string,
  seed?: number,
): Promise<GeneratedPetImage> {
  const result = await generateImage({
    completion_id: generateId(),
    app_url: context.env.APP_BASE_URL,
    context,
    args: { prompt, ...(seed === undefined ? {} : { seed }) },
    user,
  });

  if (result.status === "error") {
    throw new AssistantError(result.content || "Failed to generate a pet", ErrorType.UNKNOWN_ERROR);
  }

  const data = storedImageSchema.safeParse(result.data);
  const key = data.success ? data.data.key : undefined;

  if (!key) {
    throw new AssistantError("The generated pet could not be stored", ErrorType.UNKNOWN_ERROR);
  }

  const storage = StorageService.forPrivateAssets(context);
  const base64 = await storage.getObject(key);

  if (!base64) {
    throw new AssistantError("The generated pet could not be read back", ErrorType.UNKNOWN_ERROR);
  }

  return {
    image: `data:image/png;base64,${base64}`,
    seed: data.success ? data.data.seed : (seed ?? 0),
  };
}

export async function generatePetImage(
  context: ServiceContext,
  prompt: string,
): Promise<GeneratedPetImage> {
  const user = context.requireUser();

  assertPetAuthoring(user);

  return drawPetImage(context, user, petPrompt(prompt));
}

export async function generatePetPoses(
  context: ServiceContext,
  input: GeneratePetPosesInput,
): Promise<GeneratedPetPoses> {
  const user = context.requireUser();

  assertPetAuthoring(user);

  const drawn = await Promise.allSettled(
    PET_POSE_CLIPS.map(async (pose) => {
      const image = await drawPetImage(context, user, petPrompt(input.prompt, pose), input.seed);

      return [pose, image.image] as const;
    }),
  );
  const poses: GeneratedPetPoses["poses"] = {};

  for (const result of drawn) {
    if (result.status === "fulfilled") {
      poses[result.value[0]] = result.value[1];
    } else {
      logger.warn("A pet pose could not be drawn, the sheet will reuse the reference", {
        userId: user.id,
        error: result.reason,
      });
    }
  }

  return { poses };
}
