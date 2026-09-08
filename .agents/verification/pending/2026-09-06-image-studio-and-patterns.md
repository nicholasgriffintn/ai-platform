# Image Studio joins the catalogue, and patterns are callable

- **Change:** The canvas studio becomes an App called Image Studio, in the catalogue with the same when, uses, produces and iOS decision as every other App, reachable through the shared App route in Chat and in a project. Strudel gains a `generate_pattern` tool so a teammate can hand back a playable pattern rather than a rendered audio file.
- **Surfaces:** Web app and API. No schema change.
- **Prerequisites:** None. Enabling Image Studio in a project uses the ordinary capability flow.
- **Risk if wrong:** The studio opening without project scope, or `generate_pattern` and `create_music` being confused for each other.
- **Commits:** This branch.

## Verify

- [ ] Open Image Studio from the Apps library in Chat. Confirm it works exactly as the canvas mode did.
- [ ] Enable it in a project and open it there. Confirm it opens and that a non-member is refused.
- [ ] Confirm the catalogue card says when to reach for it, what it works from and what it leaves behind.
- [ ] Ask a conversation for a beat or a loop. Confirm `generate_pattern` runs and returns a pattern you can play, not an audio file.
- [ ] Ask for a finished piece of audio and confirm `create_music` runs instead.
- [x] Confirm the old canvas entry point still reaches the same studio.

**Stop and report if:** Image Studio opens in a project for someone who is not a member, or a pattern request produces rendered audio instead.

## Automated evidence — 8 September 2026

- Local Chromium `features/chat.spec.ts` passes the Canvas journey through the legacy entry point, switching across video, drawing and image generation surfaces and closing back to Chat. This confirms the old Canvas entry point still reaches the same studio.
- The Apps-library, project-scope, pattern-tool and `create_music` checks remain open.
