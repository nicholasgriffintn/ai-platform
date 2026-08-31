# iOS needs a new build, not just a deploy

- **Change:** iOS recovers detached turns and shows live tool activity, drops its tool toggle list in favour of server-managed tool selection, and filters the reasoning picker to models that support it. Several other items in this queue change the wire contract the app talks to.
- **Surfaces:** iOS
- **Prerequisites:** API deployed first. An old build talking to the new API is the case most likely to break.
- **Risk if wrong:** people on the shipped build hit contract changes with no way to update, and the failure looks like the API being down.
- **Commits:** `1e8e17f1` (#2130), part of `b1fc99f8` (#2144) and `48cb6e8a` (#2170)

## Verify

- [ ] Before deploying the API, open the currently shipped iOS build against the new API in preview. Confirm it still works, or note exactly what breaks — that is what your users will hit until they update.
- [ ] Build and install the new app. Confirm sign-in, conversation list, and sending a message all work.
- [ ] Send a message, background the app mid-response, and reopen it. Confirm the turn is recovered rather than lost or duplicated.
- [ ] Run a prompt that calls a tool. Confirm live tool activity is shown while it runs and resolves when it finishes.
- [ ] Open chat settings. Confirm the tool toggle list is gone, and the reasoning picker only offers models that support reasoning.
- [ ] Choose a reasoning model and confirm thinking appears and the answer completes.
- [ ] Confirm nothing in settings refers to retrieval toggles that no longer exist.

**Stop and report if:** the shipped build breaks against the new API. Decide whether to hold the API deploy or ship the app first.
