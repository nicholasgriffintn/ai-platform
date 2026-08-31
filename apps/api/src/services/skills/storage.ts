import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { AssistantError, ErrorType } from "~/utils/errors";

import { parseSkillBundle, serialiseSkillBundle, type SkillRevisionBundle } from "./bundle";

export const skillRevisionKey = (skillId: string, revisionId: string) =>
  `skills/authored/${skillId}/revisions/${revisionId}.json`;

export class SkillRevisionStorage {
  private readonly storage: StorageService;

  constructor(context: ServiceContext) {
    this.storage = StorageService.forPrivateAssets(context);
  }

  async writeRevision(
    skillId: string,
    revisionId: string,
    bundle: SkillRevisionBundle,
  ): Promise<string> {
    const key = skillRevisionKey(skillId, revisionId);

    if (await this.storage.headObject(key)) {
      throw new AssistantError("Skill revision already exists", ErrorType.CONFLICT_ERROR, 409);
    }

    await this.storage.uploadObject(key, serialiseSkillBundle(bundle), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        digest: bundle.digest,
        sizeBytes: String(bundle.sizeBytes),
      },
    });

    return key;
  }

  async getRevision(
    storageKey: string,
    expected: { digest: string; sizeBytes: number },
  ): Promise<SkillRevisionBundle | null> {
    const serialised = await this.storage.getTextObject(storageKey);

    return serialised === null ? null : parseSkillBundle(serialised, expected);
  }

  async deleteRevision(storageKey: string): Promise<void> {
    await this.storage.deleteObject(storageKey);
  }
}
