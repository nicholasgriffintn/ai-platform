import { skillSummarySchema, type SkillSummary } from "@ngriffin_uk/polychat-schemas";

import { builtInSkillDocuments } from "~/data-model/skills";
import type { ServiceContext } from "~/lib/context/serviceContext";

import { parseSkillDocument, parseUserSkillDocument, validateSkillResourcePath } from "./document";
import { listStoredStableSkillDocuments } from "./persistence";
import type { SkillStorageScope } from "./storage";
import {
  toSkillDefinition,
  toSkillSummary,
  type SkillContent,
  type SkillDefinition,
  type SkillDescriptor,
  type SkillResource,
  type SkillResourceDescriptor,
  type SkillResourceKind,
} from "./types";

interface IndexedSkill {
  definition: SkillDefinition;
  content: SkillContent;
  resources: Map<string, SkillResource>;
}

export interface SkillCatalogDocument {
  directory: string;
  rawContent: string;
  trust?: "built-in" | "user-authored";
  resources?: readonly {
    path: string;
    content: string;
  }[];
}

function cloneDefinition(skill: SkillDefinition): SkillDefinition {
  return {
    ...skill,
    tags: [...skill.tags],
    requirement: {
      modelCapabilities: [...skill.requirement.modelCapabilities],
      tools: [...skill.requirement.tools],
      suggestedTools: [...skill.requirement.suggestedTools],
    },
  };
}

function cloneContent(skill: SkillContent): SkillContent {
  return {
    ...skill,
    metadata: skill.metadata ? { ...skill.metadata } : undefined,
    resources: skill.resources?.map((resource) => ({ ...resource })),
  };
}

function resourceKind(path: string): SkillResourceKind {
  const root = path.split("/")[0];

  if (root === "references") {
    return "reference";
  }

  if (root === "scripts") {
    return "script";
  }

  if (root === "assets") {
    return "asset";
  }

  return "file";
}

function toDescriptor(document: ReturnType<typeof parseSkillDocument>): SkillDescriptor {
  const { frontmatter } = document;

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    ...(frontmatter.compatibility ? { compatibility: frontmatter.compatibility } : {}),
    ...(frontmatter.license ? { license: frontmatter.license } : {}),
    ...(frontmatter["allowed-tools"] ? { allowedTools: frontmatter["allowed-tools"] } : {}),
    ...(frontmatter.metadata ? { metadata: frontmatter.metadata } : {}),
  };
}

function withoutContent(resource: SkillResource): SkillResourceDescriptor {
  const { content: _content, ...descriptor } = resource;

  return descriptor;
}

export class SkillCatalog {
  private readonly index = new Map<string, IndexedSkill>();

  constructor(documents: readonly SkillCatalogDocument[]) {
    for (const entry of documents) {
      const document =
        entry.trust === "user-authored"
          ? parseUserSkillDocument(entry.rawContent)
          : parseSkillDocument(entry.rawContent, entry.directory);
      const descriptor = toDescriptor(document);

      if (this.index.has(descriptor.name)) {
        throw new Error(`Skill catalogue contains duplicate name ${descriptor.name}`);
      }

      const resources = new Map<string, SkillResource>();

      for (const file of entry.resources ?? []) {
        const pathIssue = validateSkillResourcePath(file.path);

        if (pathIssue) {
          throw new Error(pathIssue);
        }

        if (resources.has(file.path)) {
          throw new Error(`Skill ${descriptor.name} contains duplicate resource ${file.path}`);
        }

        resources.set(file.path, {
          path: file.path,
          kind: resourceKind(file.path),
          size: new TextEncoder().encode(file.content).byteLength,
          encoding: "text",
          mimeType: file.path.endsWith(".md") ? "text/markdown" : "text/plain",
          content: file.content,
        });
      }

      const definition = toSkillDefinition(descriptor, {
        allowAlwaysOn: entry.trust !== "user-authored",
        source: entry.trust ?? "built-in",
      });
      const summary = skillSummarySchema.safeParse(toSkillSummary(definition));

      if (!summary.success) {
        throw new Error(
          `Skill ${descriptor.name} is invalid: ${summary.error.issues
            .map((issue) => `${issue.path.join(".") || "root"} ${issue.message}`)
            .join(", ")}`,
        );
      }

      this.index.set(definition.id, {
        definition,
        content: {
          ...descriptor,
          body: document.body,
          source: entry.trust ?? "built-in",
          resources: [...resources.values()].map(withoutContent),
        },
        resources,
      });
    }
  }

  listDefinitions(): SkillDefinition[] {
    return [...this.index.values()]
      .map(({ definition }) => cloneDefinition(definition))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  getDefinition(skillId: string): SkillDefinition | undefined {
    const skill = this.index.get(skillId)?.definition;

    return skill ? cloneDefinition(skill) : undefined;
  }

  load(skillId: string): SkillContent | null {
    const content = this.index.get(skillId)?.content;

    return content ? cloneContent(content) : null;
  }

  readResource(skillId: string, path: string): SkillResource | null {
    if (validateSkillResourcePath(path)) {
      return null;
    }

    const resource = this.index.get(skillId)?.resources.get(path);

    return resource ? { ...resource } : null;
  }

  listSummaries(): SkillSummary[] {
    return this.listDefinitions().map(toSkillSummary);
  }
}

const skillCatalog = new SkillCatalog(builtInSkillDocuments);

export async function resolveSkillCatalog(
  context: ServiceContext,
  scope: SkillStorageScope,
  enabledNames?: ReadonlySet<string>,
): Promise<SkillCatalog> {
  const stored = await listStoredStableSkillDocuments(context, scope);
  const builtInNames = new Set(skillCatalog.listDefinitions().map((skill) => skill.id));
  const selected = stored.filter(
    (skill) => !builtInNames.has(skill.name) && (!enabledNames || enabledNames.has(skill.name)),
  );
  const documents = selected.map((document): SkillCatalogDocument => ({
    directory: document.name,
    rawContent: document.content,
    trust: "user-authored",
    resources: document.resources,
  }));

  return new SkillCatalog([...builtInSkillDocuments, ...documents]);
}

export async function listSkillDefinitions(): Promise<SkillDefinition[]> {
  return skillCatalog.listDefinitions();
}

export async function getSkillDefinition(skillId: string): Promise<SkillDefinition | undefined> {
  return skillCatalog.getDefinition(skillId);
}

export async function loadSkill(skillId: string): Promise<SkillContent | null> {
  return skillCatalog.load(skillId);
}

export async function getSkillResource(
  skillId: string,
  path: string,
): Promise<SkillResource | null> {
  return skillCatalog.readResource(skillId, path);
}

export async function listSkillSummaries(): Promise<SkillSummary[]> {
  return skillCatalog.listSummaries();
}
