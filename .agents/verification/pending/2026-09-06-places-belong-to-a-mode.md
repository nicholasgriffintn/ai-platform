# A place keeps the context you opened it from

- **Change:** Attention, Files and Teammates were top-level routes, so opening one from Work swapped the work sidebar for the standard one and lost the project you were in. They now live under the mode that owns them, at `/chat/attention`, `/chat/files`, `/chat/teammates` and `/work/attention`, with the project's own Files and Teammates under the project. Apps moved from `experiences` to `apps` in every path and return to the library they were opened from, and the separate apps list is gone. The work sidebar no longer lists Files and Teammates twice, and calls the project's the same thing the place is called. Every project tab now shares one header, and the project Files link stays highlighted whichever tab is open.
- **Surfaces:** Web app only. No API, schema or database change. Old paths are removed rather than redirected, so any bookmark to `/attention`, `/files`, `/teammates`, `/chat/capabilities`, `/chat/experiences` or a project's `library`, `sources` or `outputs` will 404.
- **Prerequisites:** A Pro workspace with at least one project, for the Work half.
- **Risk if wrong:** A place opening in the wrong shell, or a project path resolving to the personal one.

## Verify

- [x] In Chat, open Attention, Files and Teammates in turn. Confirm the chat sidebar stays and the URL is under `/chat`.
- [x] In a project, open Attention, Files and Teammates in turn. Confirm the work sidebar stays, the project stays selected, and Attention is filtered to that project.
- [x] Confirm the work sidebar lists Files and Teammates once each, under the project, and that both read the same as the places they open.
- [x] Open an app from the teammates library. Confirm the URL is under `apps` and that Back returns to the library, not to a separate list.
- [x] Open an app with a sub-page, such as a Replicate prediction. Confirm Back steps up one level rather than jumping to the library.
- [x] Switch between the project's Chat, Tasks and Files tabs. Confirm the project name and description stay in the same place and nothing shifts.
- [x] On the project Files tab, switch between Given, Made and Memory. Confirm the sidebar's Files entry stays highlighted throughout.
- [ ] Ask Poly to open Files while you are in Work, then again while you are in Chat. Confirm each opens the one for the mode you were in.
- [x] Confirm `/attention`, `/files`, `/teammates`, `/chat/capabilities` and `/chat/experiences` all 404 rather than redirecting.

**Stop and report if:** a place opens in the wrong shell, or a project's Files shows personal files.

## Automated evidence — 7 September 2026

- New local Chromium `features/places.spec.ts` opens Attention, Files and Teammates from the Chat sidebar and confirms each lands under `/chat`, keeps the conversations navigation, and appears once.
- In a project it opens Files and Teammates from the work sidebar, confirms each is listed once, that the sidebar and the open project survive, and that Attention carries the project's `projectId`. The filtered result set itself is not asserted.
- The project home opens on Chat with the tab marked current, and moving through Tasks, Files and Chat keeps the project name in the header. The Files tab no longer replaces the project header with its own title.
- The project Files journey now switches through Given, Made and Memory and confirms both the active Files tab and the project sidebar Files link retain `aria-current="page"`.
- `features/work.spec.ts` opens a Replicate model from the app and returns through "Back to Replicate Predictions", which steps up one level rather than to the library.
- `/attention`, `/files` and `/teammates` now answer 404 rather than 200 with the not-found page.
- Fix: `/chat/capabilities` and `/chat/experiences` answered 200 because `/chat/:completionId?` matches any single segment, so both resolved as conversation ids. Each retired path now has its own route that renders the not-found page, and the journey checks all five.
- Left open: Back from an app root returning to the library, and Poly opening the place for the mode it was asked from.

## Automated browser evidence — 8 September 2026

- The document and app-lifecycle journeys passed in `test-results/container/9b0ba7be/results.json`. They load all seven personal app runtimes from the library, return through the shared back link, refuse unenabled project apps, preserve note autosaves across reopening, and verify cancellable document drafts, word counts, saved revisions and fresh descriptions. Outbound document generation is deterministic; local API persistence and UI are real.
