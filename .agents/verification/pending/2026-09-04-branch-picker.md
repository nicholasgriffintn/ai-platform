# Hide unused branch navigation and align the picker

- **Change:** Hide Branches for conversations without related branches. Match the toolbar and show a compact hierarchy when branches exist. Collapse header labels to fit the available panel width.
- **Surfaces:** API and web Chat/Work; existing iOS clients ignore the added metadata. Sandbox and training do not use this picker.
- **Prerequisites:** Deploy API and web together; no migration.
- **Risk if wrong:** Missing navigation or unnecessary branch requests.

## Verify

- [x] Open an unbranched chat: no Branches button or branches request. Create a branch, then navigate between it and the original using the picker.
- [ ] Open the picker, switch to an unbranched conversation, then return: the picker stays closed until clicked. Check dark/light and narrow screens against Trace and Share.
- [ ] With Branches, Trace, Share and the sidebar toggle visible, check 320px, 640px and 768px widths and a narrow panel beside an open sidebar: no overlapping controls or horizontal overflow.
