import type {
  AuthoredSkill,
  AuthoredSkillDocument,
  AuthoredSkillResource,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface SkillStorageScope {
  type: "personal" | "project";
  id: string | number;
}

interface WriteSkillDocumentInput {
  name: string;
  description: string;
  content: string;
  resources?: readonly AuthoredSkillResource[];
  createdByUserId: number;
  overwrite?: boolean;
}

const skillPrefix = (scope: SkillStorageScope) =>
  scope.type === "personal" ? `skills/users/${scope.id}/` : `skills/projects/${scope.id}/`;

const skillDirectory = (scope: SkillStorageScope, name: string) => `${skillPrefix(scope)}${name}/`;

const skillKey = (scope: SkillStorageScope, name: string) =>
  `${skillDirectory(scope, name)}SKILL.md`;

const skillResourceKey = (scope: SkillStorageScope, name: string, path: string) =>
  `${skillDirectory(scope, name)}${path}`;

function formatStoredSkill(
  scope: SkillStorageScope,
  name: string,
  metadata: Record<string, string> | undefined,
  uploaded: Date,
): AuthoredSkill {
  const createdByUserId = Number(metadata?.createdByUserId);

  if (!metadata?.description || !Number.isInteger(createdByUserId) || createdByUserId <= 0) {
    throw new AssistantError("Skill object metadata is invalid", ErrorType.STORAGE_ERROR, 500);
  }

  return {
    id: name,
    name,
    description: metadata.description,
    scope:
      scope.type === "personal"
        ? { type: "personal" }
        : { type: "project", projectId: String(scope.id) },
    createdByUserId,
    createdAt: metadata.createdAt ?? uploaded.toISOString(),
    updatedAt: metadata.updatedAt ?? null,
  };
}

export class SkillDocumentStorage {
  private readonly storage: StorageService;

  constructor(context: ServiceContext) {
    this.storage = StorageService.forPrivateAssets(context);
  }

  async write(
    scope: SkillStorageScope,
    input: WriteSkillDocumentInput,
  ): Promise<AuthoredSkillDocument> {
    const key = skillKey(scope, input.name);
    const existing = await this.storage.headObject(key);

    if (existing && !input.overwrite) {
      throw new AssistantError(
        `A skill named ${input.name} already exists in this scope`,
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const now = new Date().toISOString();

    await this.storage.uploadObject(key, input.content, {
      httpMetadata: { contentType: "text/markdown; charset=utf-8" },
      customMetadata: {
        description: input.description,
        createdByUserId: String(existing?.customMetadata?.createdByUserId ?? input.createdByUserId),
        createdAt: existing?.customMetadata?.createdAt ?? existing?.uploaded.toISOString() ?? now,
        ...(existing ? { updatedAt: now } : {}),
      },
    });
    const stored = await this.storage.headObject(key);

    if (!stored) {
      throw new AssistantError("Skill document could not be stored", ErrorType.STORAGE_ERROR, 500);
    }

    const resources = await this.replaceResources(scope, input.name, input.resources ?? []);

    return {
      ...formatStoredSkill(scope, input.name, stored.customMetadata, stored.uploaded),
      content: input.content,
      resources,
    };
  }

  private async replaceResources(
    scope: SkillStorageScope,
    name: string,
    resources: readonly AuthoredSkillResource[],
  ): Promise<AuthoredSkillResource[]> {
    const existing = await this.listResourcePaths(scope, name);
    const nextPaths = new Set(resources.map((resource) => resource.path));

    await Promise.all(
      existing
        .filter((path) => !nextPaths.has(path))
        .map((path) => this.storage.deleteObject(skillResourceKey(scope, name, path))),
    );

    await Promise.all(
      resources.map((resource) =>
        this.storage.uploadObject(skillResourceKey(scope, name, resource.path), resource.content, {
          httpMetadata: { contentType: "text/markdown; charset=utf-8" },
        }),
      ),
    );

    return [...resources];
  }

  private async listResourcePaths(scope: SkillStorageScope, name: string): Promise<string[]> {
    const prefix = skillDirectory(scope, name);
    const paths: string[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.storage.listObjects({ prefix, cursor });

      for (const object of page.objects) {
        const path = object.key.slice(prefix.length);

        if (path && path !== "SKILL.md") {
          paths.push(path);
        }
      }

      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    return paths;
  }

  async listResources(scope: SkillStorageScope, name: string): Promise<AuthoredSkillResource[]> {
    const paths = await this.listResourcePaths(scope, name);
    const resources = await Promise.all(
      paths.map(async (path) => {
        const content = await this.storage.getTextObject(skillResourceKey(scope, name, path));

        return content === null ? null : { path, content };
      }),
    );

    return resources
      .filter((resource): resource is AuthoredSkillResource => resource !== null)
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  async get(scope: SkillStorageScope, name: string): Promise<AuthoredSkillDocument | null> {
    const key = skillKey(scope, name);
    const [object, content] = await Promise.all([
      this.storage.headObject(key),
      this.storage.getTextObject(key),
    ]);

    if (!object || content === null) {
      return null;
    }

    return {
      ...formatStoredSkill(scope, name, object.customMetadata, object.uploaded),
      content,
      resources: await this.listResources(scope, name),
    };
  }

  async list(scope: SkillStorageScope): Promise<AuthoredSkill[]> {
    const prefix = skillPrefix(scope);
    const skills: AuthoredSkill[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.storage.listObjects({
        prefix,
        cursor,
        include: ["customMetadata"],
      });

      for (const object of page.objects) {
        const suffix = object.key.slice(prefix.length);
        const match = suffix.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md$/);

        if (!match?.[1]) {
          continue;
        }

        skills.push(formatStoredSkill(scope, match[1], object.customMetadata, object.uploaded));
      }

      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    return skills.sort((left, right) => left.name.localeCompare(right.name));
  }

  async delete(scope: SkillStorageScope, name: string): Promise<void> {
    const resourcePaths = await this.listResourcePaths(scope, name);

    await Promise.all([
      this.storage.deleteObject(skillKey(scope, name)),
      ...resourcePaths.map((path) =>
        this.storage.deleteObject(skillResourceKey(scope, name, path)),
      ),
    ]);
  }
}
