# @ngriffin_uk/polychat-library-skills-catalogue

The Polychat skills catalogue: the built-in Agent Skills documents, the frontmatter schema that validates them, and the catalogue that resolves them into skill definitions, content and resources.

```ts
import {
  listBuiltInSkillDefinitions,
  loadBuiltInSkill,
  getBuiltInSkillResource,
  SkillCatalog,
} from "@ngriffin_uk/polychat-library-skills-catalogue";

const skills = listBuiltInSkillDefinitions();
const artifacts = loadBuiltInSkill("artifacts");
const design = getBuiltInSkillResource("artifacts", "references/design.md");

const catalogue = new SkillCatalog([{ directory: "custom", rawContent, resources: [] }]);
```

Skill documents live in `src/documents/<name>/SKILL.md` with optional `references/`, `scripts/` and `assets/` resources. `src/generated/documents.ts` embeds the raw contents so the package builds without markdown loaders.

After editing or adding documents, regenerate the embedded sources:

```sh
pnpm --filter @ngriffin_uk/polychat-library-skills-catalogue documents:sync
```

The package tests assert that the generated catalogue covers every file on disk. Use [`@ngriffin_uk/polychat-ai-skills`](../ai-skills) to retrieve skills and format them for model responses.
