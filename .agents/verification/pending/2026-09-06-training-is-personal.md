# Training is personal, and says so

- **Change:** An App can now declare that it is personal only, with a reason, and the catalogue carries both. Training is the first: it runs on your own provider credentials and deploys to your own account, so a project cannot enable it. Enabling it in a project is refused by the API rather than only hidden by the interface, it no longer appears in a project's library, and its entry point moves to You › Advanced beside Sandbox. The public catalogue marks it "Personal only".
- **Surfaces:** API and web app. Contract change in `packages/schemas`; no migration. iOS does not read the App catalogue, so it is unaffected.
- **Prerequisites:** None.
- **Risk if wrong:** Training appearing as enableable in a project, or an existing project grant continuing to work.

## Verify

- [ ] Open a project's library. Confirm Training is not offered.
- [ ] Try to enable Training in a project through the API directly. Confirm it is refused with the reason, not a generic error.
- [ ] Open You › Advanced. Confirm Training sits beside Sandbox and works exactly as it did from the Apps list.
- [ ] Confirm Training still opens from the personal Apps list.
- [ ] Open the public catalogue and confirm Training is marked "Personal only".
- [ ] Confirm every other App is still enableable in a project.
- [ ] If any project already has a Training grant from before this change, confirm what happens when it is opened, and remove the grant.

**Stop and report if:** a project can still enable Training, or an existing project grant silently keeps working.
