---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-utility-server": patch
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@ngriffin_uk/polychat-library-sites": minor
"@ngriffin_uk/polychat-component-sites": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-component-capabilities": patch
"@assistant/api": minor
"@assistant/app": minor
"@assistant/desktop": minor
---

Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`.
