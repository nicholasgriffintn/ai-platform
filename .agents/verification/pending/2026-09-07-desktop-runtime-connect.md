# Desktop runtime connection is user initiated

- **Change:** The desktop Runtimes settings page lists approved endpoints and only probes a runtime after Connect or Check is pressed.
- **Surfaces:** Desktop settings and the desktop Rust core.
- **Prerequisites:** A fresh desktop install and a local runtime with an access log, such as Ollama.
- **Risk if wrong:** The desktop could contact local or network runtime addresses without an explicit user action.
- **Commits:** Pending.

## Verify

- [ ] On a fresh install, open Profile → Runtimes and confirm the runtime access log remains empty until Connect is pressed.
- [ ] Press Connect for a running Ollama instance and confirm one readiness request, a saved row, and discovered models after the model selector is opened.
- [ ] Press Connect for an unavailable address and confirm the row is not saved and the page explains that the runtime could not be reached.
- [ ] Forget the saved endpoint and confirm the row disappears and a subsequent access-log check shows no further requests.

**Stop and report if:** opening the page or switching application focus produces a runtime request, or a failed connection leaves an endpoint or pairing secret saved.
