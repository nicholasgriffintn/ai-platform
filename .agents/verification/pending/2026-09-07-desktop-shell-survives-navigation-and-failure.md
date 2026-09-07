# The desktop shell survives navigation and failure

- **Change:** the desktop mounts each place's shell once around its routes instead of rebuilding it per page; the window's own effects moved inside the error boundary; the error page no longer traps the window; the native window title is set only under the Tauri runtime; the Work sidebar and project conversation stop re-rendering on every streamed token.
- **Surfaces:** desktop, and the Work and conversation surfaces shared with web.
- **Prerequisites:** none.
- **Risk if wrong:** navigating within Chat or Work loses the sidebar, its scroll position or the open project; a render failure leaves a blank window; the window title stops tracking the open place; a project conversation drops streamed output.
- **Commits:** None yet.

## Verify

- [ ] In the desktop window, move between Attention, Files and Teammates. Confirm the chat sidebar stays put — no flicker, and the conversation list keeps its scroll position.
- [ ] Open a project and move between its conversation, Tasks, Files, Activity and Settings. Confirm the Work sidebar stays mounted, the workspace stays expanded and the project colour does not flash.
- [ ] Confirm the window title still changes as you navigate, in the title bar and the operating system's window list.
- [ ] Send a message in a project conversation and watch it stream. Confirm the response renders normally, the sidebar does not flicker per token, and the conversation appears in the sidebar when it finishes.
- [ ] Start a project conversation from a coding-enabled project, change the task type mid-conversation, and confirm the composer control and the next request both use the new type.
- [ ] Toggle "file as task" on a project conversation, send a message, and confirm it is still filed as a task.
- [ ] In Profile → Pets and on the Pets page, confirm every built-in pet still animates.
- [ ] Force a render failure on a desktop route (a temporary throw is fine) and confirm the error page appears rather than a blank window, then use "Back to the nest" and confirm the window recovers rather than staying on the error.
- [ ] Run the renderer without Tauri (`pnpm --filter @assistant/desktop dev:renderer`) and confirm the app renders instead of white-screening; the native title is expected to stay unchanged there.
- [ ] With a task waiting, confirm the desktop still raises one system notification for it and does not repeat it every 15 seconds while it stays unread.

**Stop and report if:** a place sidebar remounts or loses state on navigation, a project conversation loses streamed output or its task-type selection, the error page cannot be left, or a notification repeats on every poll.
