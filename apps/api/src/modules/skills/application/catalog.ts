import type { SkillContent, SkillResource } from "@ngriffin_uk/polychat-ai-skills";
import {
  getBuiltInSkillCatalogue,
  type SkillCatalog,
  type SkillCatalogDocument,
  type SkillDefinition,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import type { SkillSummary } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { AuthoredSkillScope } from "~/modules/skills/infrastructure/AuthoredSkillRepository";

import { listStoredStableSkillDocuments } from "./persistence";

export {
  SkillCatalog,
  type SkillCatalogDocument,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
export type {
  LoadedSkillRuntime,
  SkillContent,
  SkillDefinition,
  SkillResource,
  SkillResourceDescriptor,
} from "@ngriffin_uk/polychat-library-skills-catalogue";

export async function resolveSkillCatalog(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  enabledNames?: ReadonlySet<string>,
): Promise<SkillCatalog> {
  const stored = await listStoredStableSkillDocuments(context, scope);
  const builtInNames = new Set(
    getBuiltInSkillCatalogue()
      .listDefinitions()
      .map((skill) => skill.id),
  );
  const selected = stored.filter(
    (skill) => !builtInNames.has(skill.name) && (!enabledNames || enabledNames.has(skill.name)),
  );
  const documents = selected.map((document): SkillCatalogDocument => ({
    directory: document.name,
    rawContent: document.content,
    trust: "user-authored",
    resources: document.resources,
    authored: {
      scope: scope.type,
      scopeId: String(scope.id),
      skillId: document.revision.skillId,
      revisionId: document.revision.id,
      revision: document.revision.revision,
    },
  }));

  return getBuiltInSkillCatalogue().extend(documents);
}

export async function listSkillDefinitions(): Promise<SkillDefinition[]> {
  return getBuiltInSkillCatalogue().listDefinitions();
}

export async function getSkillDefinition(skillId: string): Promise<SkillDefinition | undefined> {
  return getBuiltInSkillCatalogue().getDefinition(skillId);
}

export async function loadSkill(skillId: string): Promise<SkillContent | null> {
  return getBuiltInSkillCatalogue().load(skillId);
}

export async function getSkillResource(
  skillId: string,
  path: string,
): Promise<SkillResource | null> {
  return getBuiltInSkillCatalogue().readResource(skillId, path);
}

export async function listSkillSummaries(): Promise<SkillSummary[]> {
  return getBuiltInSkillCatalogue().listSummaries();
}
