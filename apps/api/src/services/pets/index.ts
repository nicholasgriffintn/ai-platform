import {
  DEFAULT_PET_PRESET_SLUG,
  PET_DESCRIPTION_MAX_LENGTH,
  PET_LIBRARY_LIMIT,
  PET_NAME_MAX_LENGTH,
  PET_SHEET_MAX_BYTES,
  PET_SHEET_MIME_TYPES,
  describePetSheetSizes,
  matchPetSheetLayout,
  type PetOrigin,
  type PetSheetLayout,
  type UserPet,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import type { UserPetRecord } from "~/repositories/UserPetRepository";
import { generateImage } from "~/services/generate/image";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { readImageDimensions } from "~/utils/imageDimensions";

const PET_STYLE_PROMPT =
  "A single small chibi mascot character, front facing, standing, full body, centred, " +
  "simple flat colours, bold dark outline, large expressive eyes, friendly, " +
  "plain solid white background, no text, no shadow, sticker style, square composition.";

function assertPetAuthoring(user: IUser): void {
  if (user.plan_id !== "pro") {
    throw new AssistantError(
      "Uploading and generating pets requires a Pro plan",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

function buildSheetUrl(context: ServiceContext, petId: string): string {
  const baseUrl = context.env.API_BASE_URL?.replace(/\/$/, "");
  const path = `/user/pets/${petId}/sheet`;

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

function assertSheetIsValid(bytes: Uint8Array): {
  mimeType: "image/png" | "image/webp";
  layout: PetSheetLayout;
} {
  const dimensions = readImageDimensions(bytes);

  if (!dimensions) {
    throw new AssistantError("The sheet must be a PNG or WebP image", ErrorType.PARAMS_ERROR, 400);
  }

  const layout = matchPetSheetLayout(dimensions.width, dimensions.height);

  if (!layout) {
    throw new AssistantError(
      `The sheet must be ${describePetSheetSizes()} pixels, not ${dimensions.width} by ${dimensions.height}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    mimeType: dimensions.format === "png" ? "image/png" : "image/webp",
    layout,
  };
}

export async function listPets(context: ServiceContext): Promise<UserPet[]> {
  const user = context.requireUser();
  const records = await context.repositories.userPets.listUserPets(user.id);

  return records.map((record) => toUserPet(context, record));
}

export async function createPet(context: ServiceContext, formData: FormData): Promise<UserPet> {
  const user = context.requireUser();

  assertPetAuthoring(user);

  const existing = await context.repositories.userPets.countUserPets(user.id);

  if (existing >= PET_LIBRARY_LIMIT) {
    throw new AssistantError(
      `You can keep ${PET_LIBRARY_LIMIT} pets. Delete one to make room.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const name = readRequiredText(formData, "name", PET_NAME_MAX_LENGTH);
  const description = readOptionalText(formData, "description", PET_DESCRIPTION_MAX_LENGTH);
  const prompt = readOptionalText(formData, "prompt", PET_DESCRIPTION_MAX_LENGTH);
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

  const buffer = await sheet.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const { mimeType, layout } = assertSheetIsValid(bytes);

  if (!PET_SHEET_MIME_TYPES.includes(mimeType)) {
    throw new AssistantError("Unsupported sheet format", ErrorType.PARAMS_ERROR, 400);
  }

  const storage = StorageService.forPrivateAssets(context);
  const extension = mimeType === "image/png" ? "png" : "webp";
  const sheetKey = `pets/${user.id}/${generateId()}.${extension}`;

  await storage.uploadObject(sheetKey, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  const record = await context.repositories.userPets.createUserPet({
    userId: user.id,
    name,
    description: description ?? null,
    origin,
    sheetKey,
    layoutId: layout.id,
    prompt: prompt ?? null,
  });

  return toUserPet(context, record);
}

export async function deletePet(context: ServiceContext, petId: string): Promise<void> {
  const user = context.requireUser();
  const record = await context.repositories.userPets.getUserPet(user.id, petId);

  if (!record) {
    throw new AssistantError("Pet not found", ErrorType.NOT_FOUND, 404);
  }

  const settings = await context.repositories.userSettings.getUserSettings(user.id);

  if (settings?.pet_source === "custom" && settings.pet_id === petId) {
    await context.repositories.userSettings.updateUserSettings(user.id, {
      pet_source: "preset",
      pet_id: DEFAULT_PET_PRESET_SLUG,
    });
  }

  await context.repositories.userPets.deleteUserPet(user.id, petId);

  const storage = StorageService.forPrivateAssets(context);

  await storage.deleteObject(record.sheet_key);
}

export async function readPetSheet(
  context: ServiceContext,
  petId: string,
): Promise<{ data: ArrayBuffer; contentType: string }> {
  const user = context.requireUser();
  const record = await context.repositories.userPets.getUserPet(user.id, petId);

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
  };
}

export async function generatePetImage(
  context: ServiceContext,
  prompt: string,
): Promise<{ image: string }> {
  const user = context.requireUser();

  assertPetAuthoring(user);

  const result = await generateImage({
    completion_id: generateId(),
    app_url: context.env.APP_BASE_URL,
    context,
    args: {
      prompt: `${PET_STYLE_PROMPT} The character is: ${prompt}`,
      width: 1024,
      height: 1024,
    },
    user,
  });

  if (result.status === "error") {
    throw new AssistantError(result.content || "Failed to generate a pet", ErrorType.UNKNOWN_ERROR);
  }

  const key = (result.data as { key?: string })?.key;

  if (!key) {
    throw new AssistantError("The generated pet could not be stored", ErrorType.UNKNOWN_ERROR);
  }

  const storage = StorageService.forPrivateAssets(context);
  const base64 = await storage.getObject(key);

  if (!base64) {
    throw new AssistantError("The generated pet could not be read back", ErrorType.UNKNOWN_ERROR);
  }

  return { image: `data:image/png;base64,${base64}` };
}
