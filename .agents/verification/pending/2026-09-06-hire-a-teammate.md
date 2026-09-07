# Hiring a teammate from a role, and the bot kind

- **Change:** Teammates can be hired from a built-in role catalogue or a job description through `POST /agents/hire` and the Hire a teammate dialog. Every teammate now has a `kind` of colleague or bot; a bot cannot file tasks or write memory, enforced by a new `denied_tools` gate in the permission checker.
- **Surfaces:** Web app and API. iOS is unaffected: it neither creates teammates nor reads the new field.
- **Prerequisites:** Migration `0032` adds `agents.kind` with a `colleague` default, so existing teammates keep their behaviour.
- **Risk if wrong:** A bot filing tasks or writing memory, a hired teammate carrying tools its role never asked for, or an existing teammate losing tools on save.
- **Commits:** This branch.

## Verify

- [x] In Teammates and tools, Add offers Hire a teammate first. Hiring a role creates a teammate with that role's brief and tools, opens its editor, and the teammate appears in the library.
- [x] Hire with a role and extra instructions; confirm the brief keeps the role's text and ends with your own. Hire with a description and a name only; confirm it is created with an empty tool list.
- [ ] Hire in a project. Confirm the teammate is owned by that workspace and is attached to the project without a further step.
- [ ] Set an existing teammate to bot in the editor and save. Confirm task and memory tools disappear from its saved tools and cannot be re-enabled while it is a bot.
- [ ] Run a bot teammate and ask it to file a task. Confirm it reports that it cannot rather than creating one, and that no task appears in the project.
- [ ] Reopen a teammate created before this change. Confirm it reads as a colleague and that saving it does not drop any tool it already had.

**Stop and report if:** a bot creates a project task or stores a memory, or saving an unchanged colleague removes tools from it.

## Automated evidence — 7 September 2026

- New local Chromium `features/hire-teammate.spec.ts` opens the personal library, confirms Hire a teammate is the first entry the keyboard lands on in Add, and hires the Research analyst role with extra instructions.
- The editor opens on the new teammate with the role brief first and the extra instruction last, with tools selected, and the teammate appears in the library.
- Hiring from a name and a job description alone creates a teammate carrying that description and no tools at all.
- Left open: hiring inside a project, the bot kind and its denied tools, and reopening a teammate created before the change.
