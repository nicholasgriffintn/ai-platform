---
"@ngriffin_uk/polychat-library-skills-catalogue": minor
"@ngriffin_uk/polychat-ai-skills": minor
"@assistant/api": patch
---

Move the built-in Agent Skills into a catalogue package. `library-skills-catalogue` owns the SKILL.md documents and resources, the frontmatter schema, document parsing and the `SkillCatalog` resolver; `ai-skills` adds retrieval, resource reads and the `<skill_content>` / `<skill_resource>` formatting. The API keeps authored-skill persistence, availability and scope, and reads built-in skills and formatting from the packages.
