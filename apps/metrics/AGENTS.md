# Metrics Overview

React + Vite dashboard visualising Analytics Engine data for Polychat usage and performance.

## Directory Highlights

- `src/App.tsx` – QueryClient provider and root component wiring analytics + dashboard.
- `src/routes/index.tsx` – Landing page with filter controls and data fetching logic.
- `src/components/` – Dashboard widgets, controls, layout primitives.
- `src/lib/utils.ts` – Shared helpers for formatting and query composition.
- `public/`, `dist/` – Static assets and build output (generated).
- `vite.config.ts`, `vitest.config.ts` – Build/test config (jsdom environment).

## Local Commands

- **Dev server**
  ```sh
  pnpm --filter @assistant/schemas build
  pnpm --filter @assistant/metrics dev
  ```
- **Build & deploy**
  ```sh
  pnpm --filter @assistant/metrics build
  pnpm --filter @assistant/metrics deploy
  ```
- **Quality**
  ```sh
  pnpm --filter @assistant/metrics lint
  pnpm --filter @assistant/metrics format
  pnpm --filter @assistant/metrics test
  ```

## Testing & Analytics

- Tests run in jsdom via Vitest; add setup in `src/test/setup.ts` if DOM globals are needed.
- Dashboard fetches the `/metrics` API; mock HTTP responses in tests to avoid live requests.
- `components/analytics.tsx` injects Beacon analytics; keep script URL and site ID in sync with production.

## Common Modification Locations

### When user requests...

**"Add new dashboard widget or chart"**

- **Component**: Create in `src/components/{WidgetName}.tsx`
- **Data fetching**: Add query to page loader or use React Query
- **API**: Fetch from `/metrics` endpoint with appropriate filters
- **Styling**: Use Tailwind classes, match existing dashboard aesthetic

**"Add new metrics filter"**

- **UI**: Update filter controls in `src/routes/index.tsx`
- **State**: Add to component state or URL params
- **API call**: Pass filters to metrics API
- **Validation**: Validate filter values before API call

**"Modify analytics tracking"**

- **File**: `src/components/analytics.tsx`
- **Configuration**: Update Beacon config or add new events
- **Testing**: Verify events fire correctly in browser dev tools
- **Privacy**: Ensure compliance with privacy policy

**"Add new visualization library"**

- **Install**: Add dependency via pnpm
- **Import**: Import in component
- **CSP**: May need to update CSP if library loads external resources
- **Bundle size**: Consider code splitting for large libraries

## Common Pitfalls & Solutions

- **Not validating filters**: Always validate user input before sending to API
- **Forgetting rate limits**: Debounce filter changes to avoid API rate limits
- **Hardcoding values**: Use constants for API endpoints, time ranges, etc.
- **Missing loading states**: Show loading indicators during data fetching
- **Not handling errors**: Display user-friendly error messages when API fails

## Guardrails

- Avoid committing files under `dist/` or other generated artefacts.
- Maintain filter param validation before calling the API; backend enforces limits, but UI should guard user input.
- Respect rate limits by debouncing new fetches when adding dashboard interactions.
- Document any new analytics events or Beacon usage when modifying `Analytics` component.
- Keep dashboard performant - limit number of simultaneous API calls
- Cache API responses when appropriate to reduce load

---

## 📋 AGENTS.md Maintenance Protocol

**IMPORTANT**: When you (the AI agent) make changes to the metrics dashboard, you MUST update this AGENTS.md file immediately after completing the implementation.

### Update Triggers

- ✅ Added new dashboard widget or visualization
- ✅ Added new metrics filter or query parameter
- ✅ Modified analytics tracking
- ✅ Changed API integration patterns
- ✅ Discovered common pitfalls

### What to Update

1. **Common Modification Locations**: Add entry for new widget/filter types
2. **Common Pitfalls**: Document problems and solutions
3. **Component Highlights**: Update if new major components added

### Update Format

- Update whichever section already describes the change; avoid introducing dated changelog snippets.
- When a brand-new subsection is warranted, use the following structure and keep future edits within it.

```markdown
### [Feature Name]

**Purpose**: [What this feature does]
**Location**: [File paths]
**Usage**: [How to use/modify]
```

**Remember**: Keep this file current as the dashboard evolves.
