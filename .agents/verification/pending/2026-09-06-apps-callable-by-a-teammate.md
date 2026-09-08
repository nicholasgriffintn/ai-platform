# Articles and Recordings are callable by a teammate

- **Change:** Two function tools join the catalogue so the Articles and Recordings apps can be run from a conversation rather than only from their own pages. `analyse_article` analyses one article and keeps the result. `process_recording` transcribes a recording that has already been uploaded. Notes already had `create_note` and `get_note`. All three respect project scope through the same helper every other tool uses, and both new tools are premium.
- **Surfaces:** API only. The apps' own pages are unchanged.
- **Prerequisites:** None.
- **Risk if wrong:** A tool running against a project the caller is not a member of, or a free-plan caller reaching a premium app through a tool.
- **Commits:** This branch.

## Verify

- [ ] In a personal conversation on a paid plan, ask for an article to be analysed. Confirm the analysis comes back and the result appears in Files › Made.
- [ ] Do the same in a project conversation as a member, and confirm the result belongs to that project.
- [x] As a free-plan account, confirm both tools are refused as premium rather than failing part way through.
- [ ] Upload a recording, then ask for it to be transcribed by name in conversation. Confirm the transcript is produced and stored.
- [x] Confirm Poly is not offered either tool.

**Stop and report if:** either tool produces a result inside a project the caller cannot access, or a premium tool runs for a free-plan account.

## Reviewed boundary evidence — 8 September 2026

- Both analyse_article and process_recording declare premium tool access. The reviewed handleFunctions dispatcher checks that descriptor before invoking either implementation; PermissionChecker tests reject non-Pro callers with the premium-subscription reason. This validates the shared dispatch boundary rather than calling a live transcription provider.

## Further verified evidence — 8 September 2026

- Container `379708a8` passed both Poly and Discover regressions. Poly preserves the underlying draft and refuses a provider-requested save_skill at the execution boundary; the shared scope filter and supplied-tool regression cover article/recording exclusions and the reverse non-meta restriction. Discover now includes every provider rather than hiding those after the first twelve.
