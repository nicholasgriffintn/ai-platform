# Review unified Project Workbench activity

- **Change:** Activity now combines conversation trace and ordered coding-run evidence, with command output and cost details collapsed.
- **Surfaces:** Work project conversations on web and sandbox event production.
- **Prerequisites:** A coding run containing a plan, commands, validation and either an approval, retry or failure.
- **Risk if wrong:** Activity may reorder work after refresh, hide why a run stopped, repeat noisy output or expose sensitive text.
- **Commits:** None recorded.

## Verify

- [ ] Open Activity during a run and confirm plans, model and tool actions, commands, approvals, instructions and validation appear in the order they happen.
- [ ] Expand command output and cost or latency details, then confirm both remain collapsed by default after refresh and that command duration appears only when recorded.
- [ ] Disconnect and reload during a run, then confirm restored Activity preserves event order and does not duplicate streamed events.
- [ ] Inspect a failed or cancelled run and confirm Activity explains the terminal outcome without showing model reasoning, tool arguments or credentials.

**Stop and report if:** refresh changes event order, command output floods the panel, the stopping reason is absent, or hidden reasoning or credentials are visible.
