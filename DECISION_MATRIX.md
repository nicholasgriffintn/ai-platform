# Decision Matrix for AI Agents

Quick reference guide for determining where to make changes in the Polychat monorepo.

## I need to add...

| What | Primary Location | Secondary Locations | Notes |
|------|------------------|---------------------|-------|
| **API endpoint** | `apps/api/src/routes/{domain}.ts` | `packages/schemas/src/` (schemas first)<br>`apps/api/src/services/{domain}/` (business logic)<br>`apps/api/src/repositories/` (if DB access needed) | Always define schemas first, rebuild, then implement route |
| **Authentication logic** | `apps/api/src/middleware/auth.ts` | Route files (apply middleware)<br>`apps/api/src/routes/auth/` (auth endpoints) | Use `allowRestrictedPaths` or custom middleware |
| **Rate limiting** | `apps/api/src/middleware/rateLimit.ts` | `wrangler.jsonc` (bindings)<br>Route files (apply middleware) | Configure FREE_RATE_LIMITER or PRO_RATE_LIMITER |
| **Database table** | `apps/api/src/lib/database/schema.ts` | `apps/api/src/repositories/{Entity}Repository.ts`<br>`apps/api/migrations/` (auto-generated)<br>`packages/schemas/src/` (if exposed to frontend) | Generate migration, apply locally, create repository |
| **AI provider** | `apps/api/src/lib/providers/provider/{name}.ts` | `apps/api/src/lib/providers/factory.ts` (register)<br>`apps/api/src/lib/models/index.ts` (models)<br>`apps/api/src/lib/usageManager.ts` (pricing) | Extend BaseAIProvider, implement required methods |
| **Frontend page** | `apps/app/src/pages/{name}.tsx` | `apps/app/src/routes.ts` (routing)<br>`apps/app/src/lib/api/services/{name}.ts` (API client)<br>`apps/app/src/state/stores/{name}Store.ts` (state) | Add route, create API service, add store if needed |
| **UI component** | `apps/app/src/components/{Name}/{Name}.tsx` | `apps/app/src/components/ui/` (if reusable)<br>`apps/app/src/components/{Name}/{Name}.test.tsx` (tests) | Use shadcn/ui for shared components |
| **State management** | `apps/app/src/state/stores/{name}Store.ts` | Component files (useStore hook) | Use Zustand with persist middleware if needed |
| **API integration** | `apps/app/src/lib/api/services/{name}.ts` | `packages/schemas/src/` (types)<br>`apps/app/src/lib/api/fetch-wrapper.ts` (always use this) | Always use fetch-wrapper for auth/CSRF |
| **Shared types/validation** | `packages/schemas/src/{domain}.ts` | `packages/schemas/src/index.ts` (export) | Rebuild schemas after changes |
| **Business logic** | `apps/api/src/services/{domain}/{feature}.ts` | Never in routes - always in services | Use repositories for DB access |
| **Middleware** | `apps/api/src/middleware/{name}.ts` | `apps/api/src/index.ts` (register globally)<br>Route files (apply to specific routes) | Signature: `async (c: Context, next: Next) => {}` |
| **Background task** | `apps/api/src/services/tasks/` | `apps/api/src/routes/tasks.ts` (submission)<br>`wrangler.jsonc` (queue bindings) | Use QueueExecutor or ScheduleExecutor |
| **Dynamic app/tool** | `apps/api/src/routes/apps/{name}.ts` | `apps/api/src/services/apps/{name}.ts`<br>`apps/api/src/services/dynamic-apps/auto-register-apps.ts`<br>`packages/schemas/src/apps.ts` | Register in auto-register-apps |
| **Custom hook** | `apps/app/src/hooks/{name}.ts` | Component files (use hook) | Prefix with `use` (e.g., `useExample`) |
| **Dashboard widget** | `apps/metrics/src/components/{WidgetName}.tsx` | `apps/metrics/src/routes/index.tsx` (add to dashboard) | Fetch from `/metrics` API endpoint |
| **iOS feature** | `apps/mobile/ios/Polychat/{feature}.swift` | `apps/mobile/ios/PolychatTests/` (tests) | Use Xcode to modify project settings |

## I need to modify...

| Feature | Primary Files | What to Change | Testing |
|---------|---------------|----------------|---------|
| **Chat completions** | `apps/api/src/routes/chat.ts`<br>`apps/api/src/services/completions/` | Add service function, update route | Service tests, integration tests |
| **User authentication** | `apps/api/src/middleware/auth.ts`<br>`apps/api/src/routes/auth/` | Update auth logic, add/modify endpoints | Test with various auth states |
| **Database schema** | `apps/api/src/lib/database/schema.ts` | Update table definition, generate migration | Test migration up/down |
| **API models** | `apps/api/src/lib/models/index.ts` | Add/update model configurations | Update model router if needed |
| **Error handling** | `apps/api/src/utils/errors.ts`<br>Service files | Use AssistantError with ErrorType | Test error scenarios |
| **Frontend constants** | `apps/app/src/constants.ts` | Update CSP, env vars, feature flags | Update .env files |
| **Routing** | `apps/app/src/routes.ts` | Add/modify routes | Test navigation |
| **Shared schemas** | `packages/schemas/src/{domain}.ts` | Update schema, rebuild | Update all consumers |

## I need to debug...

| Issue Type | Check These Locations | Common Causes |
|------------|----------------------|---------------|
| **API endpoint not working** | `apps/api/src/routes/`<br>`apps/api/src/middleware/`<br>Browser Network tab | Missing middleware, auth failure, validation error |
| **TypeScript errors** | `packages/schemas/` (rebuild needed?)<br>`tsconfig.json` files | Stale schema build, incorrect imports |
| **Database errors** | `apps/api/src/lib/database/schema.ts`<br>`apps/api/migrations/` | Migration not applied, schema mismatch |
| **Frontend API calls failing** | `apps/app/src/lib/api/fetch-wrapper.ts`<br>Browser console<br>Network tab | CSRF token missing, auth issues, CORS |
| **State not persisting** | `apps/app/src/state/stores/` | Check persist middleware, localStorage |
| **CSP violations** | `apps/app/src/constants.ts` (CSP object)<br>Browser console | Missing domain in CSP config |
| **Build failures** | `package.json` (scripts)<br>`tsconfig.json`<br>`vite.config.ts` / `react-router.config.ts` | Dependency issues, config errors |
| **Test failures** | `vitest.config.ts`<br>`playwright.config.ts`<br>Test files | Mock configuration, environment setup |

## Common Workflows

### Adding a New Feature End-to-End

1. **Define contract**
   - `packages/schemas/src/{domain}.ts` - Add request/response schemas
   - `pnpm --filter @assistant/schemas build` - Rebuild schemas

2. **Backend implementation**
   - `apps/api/src/lib/database/schema.ts` - Add table if needed
   - `pnpm run db:generate && pnpm run db:migrate:local` - If DB changes
   - `apps/api/src/repositories/{Entity}Repository.ts` - Create repository
   - `apps/api/src/services/{domain}/{feature}.ts` - Implement business logic
   - `apps/api/src/routes/{domain}.ts` - Add route with validation

3. **Frontend implementation**
   - `apps/app/src/lib/api/services/{name}.ts` - Create API client
   - `apps/app/src/state/stores/{name}Store.ts` - Add state if needed
   - `apps/app/src/pages/{name}.tsx` - Create page
   - `apps/app/src/routes.ts` - Add route

4. **Testing**
   - Add service tests in `apps/api/src/services/{domain}/__test__/`
   - Add component tests in `apps/app/src/components/{Name}/`
   - Add E2E tests if complex flow

5. **Documentation**
   - Update relevant AGENTS.md files
   - Add to this DECISION_MATRIX.md if new pattern

### Changing Shared Schemas

1. **Evaluate impact**
   - Is this a breaking change?
   - Which apps consume this schema? (API, app, metrics)

2. **Make changes**
   - `packages/schemas/src/{domain}.ts` - Update schema
   - Use `.optional()` or `.default()` for non-breaking additions

3. **Rebuild and update consumers**
   - `pnpm --filter @assistant/schemas build`
   - Update API routes and services
   - Update frontend API services and components
   - Update metrics if it uses the schema

4. **Test across apps**
   - `pnpm run typecheck` - Check all apps
   - `pnpm run test` - Run all tests
   - Manual testing in each app

5. **Document**
   - Update `packages/schemas/AGENTS.md`
   - Note breaking changes in PR description

### Debugging CORS/Auth Issues

1. **Check browser console** - Look for CORS or 401/403 errors
2. **Verify fetch-wrapper usage** - `apps/app/src/lib/api/` - Must use wrapper
3. **Check middleware chain** - `apps/api/src/index.ts` - CORS, CSRF, auth order
4. **Check environment** - Verify API_BASE_URL matches running API
5. **Check bindings** - `apps/api/wrangler.jsonc` - Env vars configured correctly

## Quick Reference: File Paths

```
├── packages/
│   └── schemas/              # Shared Zod schemas (always rebuild after changes)
│       ├── src/*.ts          # Schema definitions
│       └── src/index.ts      # Barrel exports
│
├── apps/
│   ├── api/                  # Cloudflare Worker API
│   │   ├── src/
│   │   │   ├── index.ts      # Hono app entry, middleware registration
│   │   │   ├── routes/       # Route handlers with OpenAPI docs
│   │   │   ├── services/     # Business logic (never in routes)
│   │   │   ├── repositories/ # Database access layer (Drizzle)
│   │   │   ├── middleware/   # Auth, rate limit, logging, etc.
│   │   │   ├── lib/
│   │   │   │   ├── providers/  # AI provider implementations
│   │   │   │   ├── models/     # Model configurations
│   │   │   │   ├── database/   # Schema and DB utilities
│   │   │   │   └── ...
│   │   │   └── utils/        # Errors, logging, etc.
│   │   └── migrations/       # Drizzle migrations (auto-generated)
│   │
│   ├── app/                  # React Router 7 frontend
│   │   ├── src/
│   │   │   ├── root.tsx      # App shell
│   │   │   ├── routes.ts     # Route configuration
│   │   │   ├── pages/        # Page components with loaders
│   │   │   ├── components/   # UI components
│   │   │   ├── lib/
│   │   │   │   └── api/      # API service clients (use fetch-wrapper!)
│   │   │   ├── state/stores/ # Zustand stores
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   └── constants.ts  # CSP, env vars, feature flags
│   │   └── public/           # Static assets
│   │
│   ├── metrics/              # Analytics dashboard
│   │   └── src/
│   │       ├── components/   # Dashboard widgets
│   │       └── routes/       # Dashboard pages
│   │
│   └── mobile/ios/           # iOS native app
│       └── Polychat/         # Swift source files
│
└── AGENTS.md files           # Must update after making changes!
    ├── /AGENTS.md            # This file - monorepo overview
    ├── /apps/api/AGENTS.md   # API patterns and practices
    ├── /apps/app/AGENTS.md   # Frontend patterns and practices
    ├── /packages/schemas/AGENTS.md  # Schema management
    └── ...
```

## Need More Help?

- **Root AGENTS.md**: Architecture, cross-cutting patterns, build commands
- **apps/api/AGENTS.md**: API implementation patterns, routes, services, repositories
- **apps/app/AGENTS.md**: Frontend patterns, components, state management
- **packages/schemas/AGENTS.md**: Schema creation and breaking change management
- **apps/metrics/AGENTS.md**: Dashboard widgets and analytics
- **apps/mobile/ios/AGENTS.md**: iOS native development

**Remember**: Always update AGENTS.md files when you discover new patterns or make significant changes!
