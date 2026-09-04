# Choose an automatic model preference for a project

- **Change:** Save a project default of Auto, Lite, Standard, Pro, or Max on the Work project overview. Project conversations use it when their composer is on Auto; explicit tiers and models override it.
- **Surfaces:** web and API. Personal Chat stays unchanged. iOS has no project settings surface and needs no new request field. Sandbox and training model selection are separate and unchanged.
- **Prerequisites:** Apply `apps/api/migrations/0020_old_switch.sql` before deploying the API. It adds `project.default_router_mode` with an `auto` default. No new secrets or bindings.
- **Risk if wrong:** Project Auto requests use the wrong model tier, updates fail to persist, or ordinary members can change shared defaults.
- **Commits:** See the PR containing this item.

## Verify

- [x] As a workspace owner/admin, open a Work project overview, choose Lite under **Automatic model preference**, and save. Reload: Lite remains selected. As an ordinary member, the selected value is visible and the control is disabled. _(Local release E2Es cover owner persistence and an invited member.)_
- [ ] Send a project message with the composer on Auto and inspect the selected model in the response. The router should prefer the Lite pool; suitability and access rules can still select another available model. Resume the conversation without changing Auto and confirm the same preference applies.
- [x] Select Max in the composer, then select a specific accessible model. Each explicit choice overrides the saved Lite default. _(Local release E2E completes both requests and asserts the submitted tier/model contract.)_
- [ ] Save **Auto — no project preference** on the project overview. Reload and verify the value stays Auto and project routing uses the ordinary pool. _(Local release E2E verifies persistence; manually inspect the selected ordinary-pool model.)_
- [x] Save a project with Lite as a template and create a project from it. The new project shows Lite. _(Local release E2E covers the governed template lifecycle.)_
- [x] As an ordinary member, send `PUT /projects/<projectId>` with `{"defaultRouterMode":"max"}`. Expect 403 and no saved change. As an outsider, expect 404. Send an unsupported tier as an admin and expect a validation error. _(Local release E2E verifies 403, 404, 400 and the unchanged owner value.)_
- [x] Confirm personal Chat Auto still uses the ordinary router, and a personal conversation cannot be attached to a project by adding `metadata.project_id` to a continuation request. _(Local release E2E confirms Auto submits no project metadata and a forged project continuation is refused with 409.)_

**Stop and report if:** a saved preference disappears on reload, an explicit model is overridden, or an unauthorised user can update a project preference.
