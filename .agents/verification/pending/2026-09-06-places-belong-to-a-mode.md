# A place keeps the context you opened it from

- **Change:** Attention, Files and Teammates were top-level routes, so opening one from Work swapped the work sidebar for the standard one and lost the project you were in. They now live under the mode that owns them, at `/chat/attention`, `/chat/files`, `/chat/teammates` and `/work/attention`, with the project's own Files and Teammates under the project. Apps moved from `experiences` to `apps` in every path and return to the library they were opened from, and the separate apps list is gone. The work sidebar no longer lists Files and Teammates twice, and calls the project's the same thing the place is called. Every project tab now shares one header, and the project Files link stays highlighted whichever tab is open.
- **Surfaces:** Web app only. No API, schema or database change. Old paths are removed rather than redirected, so any bookmark to `/attention`, `/files`, `/teammates`, `/chat/capabilities`, `/chat/experiences` or a project's `library`, `sources` or `outputs` will 404.
- **Prerequisites:** A Pro workspace with at least one project, for the Work half.
- **Risk if wrong:** A place opening in the wrong shell, or a project path resolving to the personal one.

## Verify

- [ ] In Chat, open Attention, Files and Teammates in turn. Confirm the chat sidebar stays and the URL is under `/chat`.
- [ ] In a project, open Attention, Files and Teammates in turn. Confirm the work sidebar stays, the project stays selected, and Attention is filtered to that project.
- [ ] Confirm the work sidebar lists Files and Teammates once each, under the project, and that both read the same as the places they open.
- [ ] Open an app from the teammates library. Confirm the URL is under `apps` and that Back returns to the library, not to a separate list.
- [ ] Open an app with a sub-page, such as a Replicate prediction. Confirm Back steps up one level rather than jumping to the library.
- [ ] Switch between the project's Chat, Tasks and Files tabs. Confirm the project name and description stay in the same place and nothing shifts.
- [ ] On the project Files tab, switch between Given, Made and Memory. Confirm the sidebar's Files entry stays highlighted throughout.
- [ ] Ask Poly to open Files while you are in Work, then again while you are in Chat. Confirm each opens the one for the mode you were in.
- [ ] Confirm `/attention`, `/files`, `/teammates`, `/chat/capabilities` and `/chat/experiences` all 404 rather than redirecting.

**Stop and report if:** a place opens in the wrong shell, or a project's Files shows personal files.
