# The apps open in the desktop window and still open on the web

- **Change:** `AppRoute`, `AppRuntime` and the Notes, Articles, Recordings, Strudel, image studio, Replicate and fine-tuning runtimes moved into `component-shell`, and the desktop window serves `/chat/apps/:appId/*`.
- **Surfaces:** web, desktop.
- **Prerequisites:** none.
- **Risk if wrong:** an app that worked on the web stops loading, or an app loads in the desktop window and then fails at runtime on a dependency the window does not bundle.

## Verify

- [ ] On the web, open each app from Teammates and confirm it loads: Notes, Articles, Recordings, Strudel, the image studio, Replicate and fine-tuning.
- [ ] Create and save a note, then reopen it, and confirm the editor still auto-saves.
- [ ] Play a Strudel pattern and confirm audio starts — this is the runtime that loads through dynamic imports.
- [ ] Open the same apps inside a Work project and confirm the not-enabled state still appears for an app the project has not added.
- [ ] In the desktop window, open each app from Teammates and repeat the load check, paying particular attention to Strudel and the image studio.
- [ ] Open `/chat/apps/does-not-exist` in both hosts and confirm the app-not-found state rather than a blank screen.

**Stop and report if:** an app renders on the web but throws a module or content security policy error in the desktop window.
