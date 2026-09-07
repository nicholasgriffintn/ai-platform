# Teammates, the teammate editor and the tool runner work in both hosts

- **Change:** the capability library, its dialogs, the recipe workflow controller, the connector setup dialogs and the teammate editor moved into `component-shell`, and the desktop window serves `/chat/teammates`, `/chat/teammates/:teammateId` and `/chat/tools/:toolId`.
- **Surfaces:** web, desktop.
- **Prerequisites:** none.
- **Risk if wrong:** hiring, sharing, configuring or running a capability breaks on the web, or the desktop sidebar keeps leading to a 404.

## Verify

- [ ] On the web, open Teammates from the chat sidebar and confirm teammates, apps, automations and tools all list.
- [ ] Hire a teammate, edit it, then delete it, and confirm the list agrees with the API each time.
- [ ] Share a teammate to a workspace and then revoke that share.
- [ ] Configure a tool, run it from the tool runner, and confirm the result renders.
- [ ] Set up a connector that needs an API key and confirm the key dialog stores it.
- [ ] Open the same library inside a Work project and confirm it still scopes to that project.
- [ ] Repeat the list, hire, edit and run checks in the desktop window.
- [ ] In the desktop window, open `/chat/apps/notes` and confirm it answers a clear not-found rather than an empty screen.

**Stop and report if:** a capability appears in a scope the signed-in account cannot access, or a connector key is stored against the wrong provider.
