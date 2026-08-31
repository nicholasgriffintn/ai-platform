import {
  MAX_AUTHORED_SKILL_BUNDLE_BYTES,
  authoredSkillResourceSchema,
  type AuthoredSkillResource,
} from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";

const SKILL_BUNDLE_VERSION = 1;

interface SkillBundlePayload {
  content: string;
  resources: AuthoredSkillResource[];
}

export interface SkillRevisionBundle extends SkillBundlePayload {
  version: typeof SKILL_BUNDLE_VERSION;
  digest: string;
  sizeBytes: number;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function canonicalPayload(content: string, resources: readonly AuthoredSkillResource[]) {
  return JSON.stringify({ content, resources });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normaliseResources(resources: readonly AuthoredSkillResource[]): AuthoredSkillResource[] {
  if (resources.length > 32) {
    throw new AssistantError(
      "Skill bundle must contain 32 resources or fewer",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const sorted = resources.map((resource) => authoredSkillResourceSchema.parse(resource));

  sorted.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]?.path === sorted[index]?.path) {
      throw new AssistantError(
        `Skill bundle contains duplicate resource ${sorted[index]?.path}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  return sorted;
}

export async function createSkillBundle(
  content: string,
  resources: readonly AuthoredSkillResource[] = [],
): Promise<SkillRevisionBundle> {
  const normalisedResources = normaliseResources(resources);
  const payload = { content, resources: normalisedResources };
  const canonical = canonicalPayload(payload.content, payload.resources);
  const sizeBytes = byteLength(canonical);

  if (sizeBytes > MAX_AUTHORED_SKILL_BUNDLE_BYTES) {
    throw new AssistantError(
      `Skill bundle must be ${MAX_AUTHORED_SKILL_BUNDLE_BYTES} bytes or smaller`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    version: SKILL_BUNDLE_VERSION,
    digest: await sha256Hex(canonical),
    sizeBytes,
    ...payload,
  };
}

export async function parseSkillBundle(
  serialised: string,
  expected: { digest: string; sizeBytes: number },
): Promise<SkillRevisionBundle> {
  let value: unknown;

  try {
    value = JSON.parse(serialised);
  } catch {
    throw new AssistantError("Skill revision bundle is invalid", ErrorType.STORAGE_ERROR, 500);
  }

  if (!value || typeof value !== "object") {
    throw new AssistantError("Skill revision bundle is invalid", ErrorType.STORAGE_ERROR, 500);
  }

  const candidate = value as Partial<SkillRevisionBundle>;

  if (candidate.version !== SKILL_BUNDLE_VERSION || typeof candidate.content !== "string") {
    throw new AssistantError("Skill revision bundle is invalid", ErrorType.STORAGE_ERROR, 500);
  }

  let rebuilt: SkillRevisionBundle;

  try {
    rebuilt = await createSkillBundle(
      candidate.content,
      Array.isArray(candidate.resources) ? candidate.resources : [],
    );
  } catch (error) {
    throw new AssistantError("Skill revision bundle is invalid", ErrorType.STORAGE_ERROR, 500, {
      originalError: error instanceof Error ? error.message : "Unknown validation error",
    });
  }

  if (
    candidate.digest !== rebuilt.digest ||
    candidate.sizeBytes !== rebuilt.sizeBytes ||
    rebuilt.digest !== expected.digest ||
    rebuilt.sizeBytes !== expected.sizeBytes
  ) {
    throw new AssistantError(
      "Skill revision bundle failed its integrity check",
      ErrorType.STORAGE_ERROR,
      500,
    );
  }

  return rebuilt;
}

export function serialiseSkillBundle(bundle: SkillRevisionBundle): string {
  return JSON.stringify(bundle);
}
