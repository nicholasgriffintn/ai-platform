# Teammates, the teammate editor and the tool runner work in both hosts

- **Change:** the capability library, its dialogs, the recipe workflow controller, the connector setup dialogs and the teammate editor moved into `component-shell`, and the desktop window serves `/chat/teammates`, `/chat/teammates/:teammateId` and `/chat/tools/:toolId`.
- **Surfaces:** web, desktop.
- **Prerequisites:** none.
- **Risk if wrong:** hiring, sharing, configuring or running a capability breaks on the web, or the desktop sidebar keeps leading to a 404.

## Verify

- [ ] On the web, open Teammates from the chat sidebar and confirm teammates, apps, automations and tools all list.
- [x] Hire a teammate, edit it, then delete it, and confirm the list agrees with the API each time.
- [ ] Share a teammate to a workspace and then revoke that share.
- [x] Configure a tool, run it from the tool runner, and confirm the result renders.
- [x] Set up a connector that needs an API key and confirm the key dialog stores it.
- [x] Open the same library inside a Work project and confirm it still scopes to that project.
- [ ] Repeat the list, hire, edit and run checks in the desktop window.
- [ ] In the desktop window, open `/chat/apps/notes` and confirm it answers a clear not-found rather than an empty screen.

**Stop and report if:** a capability appears in a scope the signed-in account cannot access, or a connector key is stored against the wrong provider.

## Reconciled automated evidence — 8 September 2026

- `features/profile.spec.ts` stores a Netlify API-key connector credential through the dialog, checks Connected, disconnects it and checks that Connected disappears.
- These existing journeys are covered by the successful 239-journey release run recorded in [local evidence](../2026-09-05-local-evidence.md). This is recorded web evidence, not a new run or desktop verification.

## Automated evidence — 8 September 2026, container b2276b14

- `features/profile.spec.ts` creates a teammate through its editor, edits it and deletes it; the library and parsed API list agree at every step. This is web evidence.
- The targeted batch recorded 14 passing journeys and one failing composer assertion. Only the passing journeys support these check-offs.

## Reconciled web E2E evidence — 8 September 2026

- The successful 239-journey run includes the dynamic project tool journey: enable Create Qr Code, open Run, fill payload and size, submit, await the real execution response, view Results and reopen the saved output from Made. The external QR image response is substituted.
- See [7 September release evidence](../2026-09-05-local-evidence.md) and [8 September focused evidence](../2026-09-08-local-evidence.md). These are reconciled existing results, not another run or a deployed/desktop certification.

## Further verified evidence — 8 September 2026

- The passing project teammate-feedback and app-lifecycle journeys open the project library and validate workspace ownership, project attachment and scoped app enablement. This closes the web project-library item only.
