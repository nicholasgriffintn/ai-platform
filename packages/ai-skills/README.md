# @ngriffin_uk/polychat-ai-skills

Skill retrieval and formatting over the built-in skills catalogue.

```ts
import {
  formatSkillContent,
  getSkill,
  getSkillResource,
  listSkills,
  loadSkill,
} from "@ngriffin_uk/polychat-ai-skills";

const skills = listSkills();
const council = getSkill("council");
const content = loadSkill("artifacts");
const design = getSkillResource("artifacts", "references/design.md");

const promptText = content ? formatSkillContent(content) : "";
```

- `listSkills` / `listSkillSummaries` describe every built-in skill.
- `getSkill`, `loadSkill` and `getSkillResource` read from the catalogue; `requireSkill` throws for unknown ids.
- `formatSkillContent` and `formatSkillResource` produce the `<skill_content>` and `<skill_resource>` XML with HTML escaping.
- `isSkillResourceWithinLoadLimit` and `MAX_SKILL_RESOURCE_CONTENT_BYTES` bound how much a resource may add to a conversation.

Host runtimes that merge user-authored skills can use `SkillCatalog` from [`@ngriffin_uk/polychat-library-skills-catalogue`](../library-skills-catalogue) directly; persistence and authorisation stay with the host.
