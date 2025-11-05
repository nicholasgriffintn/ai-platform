# API Overview

Cloudflare Worker backend serving OpenAI-compatible endpoints, provider routing, guardrails, and analytics for Polychat.

## Directory Highlights

- `src/index.ts` – Hono entrypoint registering middleware, routes, and error handling.
- `src/routes/` – HTTP route handlers (chat, tools, apps, auth, metrics).
- `src/services/` – Business logic for completions, dynamic apps, metrics, etc.
- `src/lib/` – Core primitives (providers, models, cache, monitoring, usage manager).
- `src/repositories/` – D1 database access via Drizzle ORM.
- `src/lib/database/schema.ts` – Source of truth for D1 schema; migrations generated from here.
- `migrations/` – Drizzle-generated SQL migration files (auto-generated only).
- `wrangler.jsonc` – Worker bindings (D1, KV, Vectorize, R2, rate limiters).

## Local Commands

- **Dev server**
  ```sh
  pnpm --filter @assistant/schemas build
  pnpm --filter @assistant/api dev
  ```
- **Type checking**
  ```sh
  pnpm --filter @assistant/api typecheck
  ```
- **Lint & format**
  ```sh
  pnpm --filter @assistant/api lint
  pnpm --filter @assistant/api format
  ```
- **Unit tests / coverage**
  ```sh
  pnpm --filter @assistant/api test
  pnpm --filter @assistant/api coverage
  ```
- **Migrations**
  ```sh
  pnpm --filter @assistant/api db:generate      # create new migration (adds file under migrations/)
  pnpm --filter @assistant/api db:migrate:local # apply to local D1 (requires wrangler)
  ```

## Testing Expectations

- Run `pnpm --filter @assistant/api test` and `pnpm --filter @assistant/api typecheck` before pushing worker changes.
- When routes or schemas change, execute `pnpm --filter @assistant/schemas build` to ensure shared types stay in sync.
- Regenerate and apply migrations locally for any schema changes; include the generated SQL in the PR.
- Integration tests rely on wrangler’s D1 bindings; prefer Vitest unit tests for provider/service logic.

## Implementation Patterns

### Route Handler Pattern

**Modern Pattern** (Use ServiceContext):
```typescript
// src/routes/example.ts
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import {
	exampleRequestSchema,
	exampleResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";
import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { handleExampleService } from "~/services/example/exampleService";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import type { Context } from "hono";

app.post(
	"/example",
	validateCaptcha, // Add if user-facing endpoint
	describeRoute({
		tags: ["example"],
		summary: "Brief description for API docs",
		description: "Detailed description of what this endpoint does",
		responses: {
			200: {
				description: "Success response",
				content: {
					"application/json": { schema: resolver(exampleResponseSchema) },
				},
			},
			400: {
				description: "Bad request or validation error",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
			401: {
				description: "Authentication error",
				content: {
					"application/json": { schema: resolver(errorResponseSchema) },
				},
			},
		},
	}),
	zValidator("json", exampleRequestSchema),
	async (context: Context) => {
		const body = context.req.valid("json");

		// Use getServiceContext to get all dependencies at once
		const serviceContext = getServiceContext(context);

		// Pass ServiceContext to the service
		const response = await handleExampleService(serviceContext, body);

		// If service returns Response (streaming), return directly
		if (response instanceof Response) {
			return response;
		}

		// Otherwise wrap in standard response
		return ResponseFactory.success(context, response);
	},
);
```

### Service Function Pattern

**Modern Pattern** (Use ServiceContext):
```typescript
// src/services/example/exampleService.ts
import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger, LogLevel } from "~/utils/logger";
import type { ExampleRequest, ExampleResponse } from "@assistant/schemas";

export async function handleExampleService(
	context: ServiceContext,
	request: ExampleRequest,
): Promise<ExampleResponse> {
	const logger = getLogger("example-service", LogLevel.INFO);

	try {
		// Validate business rules
		if (!request.required_field) {
			throw new AssistantError(
				"Missing required field",
				ErrorType.VALIDATION_ERROR,
			);
		}

		// Use ServiceContext helper methods
		const user = context.requireUser(); // Throws if no user
		context.ensureDatabase(); // Throws if no database

		// Access repositories directly from context
		const entity = await context.repositories.example.findById(request.id);

		if (!entity) {
			throw new AssistantError("Entity not found", ErrorType.NOT_FOUND);
		}

		// Access env from context if needed
		const apiKey = context.env.SOME_API_KEY;

		// Perform business logic
		const result = await processExample(entity, request);

		logger.info("Example service completed", { entityId: request.id });

		// Return typed data
		return { success: true, data: result };
	} catch (error) {
		logger.error("Example service error", error);
		throw error; // Let route handler catch and format
	}
}
```

**Benefits of ServiceContext Pattern:**
- **Single parameter**: Instead of passing `env`, `user`, `anonymousUser` separately, pass one `context` object
- **Helper methods**: Use `context.requireUser()` and `context.ensureDatabase()` for automatic validation
- **Lazy loading**: `context.repositories` and `context.database` are only created when accessed
- **Type safety**: Strong typing for all context properties
- **Consistency**: Same pattern across all services
- **Easy testing**: Mock one context object instead of multiple parameters

### Database and Repository Pattern

**Database Class** - Simplified wrapper around RepositoryManager:
```typescript
// src/lib/database/index.ts
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";

export class Database {
	private _repositories: RepositoryManager;
	private env: IEnv;

	constructor(env: IEnv) {
		this.env = env;
		this._repositories = new RepositoryManager(env);
	}

	// Access repositories directly
	public get repositories(): RepositoryManager {
		return this._repositories;
	}

	// Complex business logic methods that coordinate multiple repositories
	public async createUser(userData) {
		const user = await this._repositories.users.createUser(userData);

		// Create related entities
		await this._repositories.userSettings.createUserSettings(user.id);
		await this._repositories.userSettings.createUserProviderSettings(user.id);

		return user;
	}

	public async deleteAllChatCompletions(userId: number) {
		const conversations = await this._repositories.conversations.getUserConversations(userId);

		for (const conv of conversations) {
			await this._repositories.messages.deleteAllMessages(conv.id);
			await this._repositories.conversations.deleteConversation(conv.id);
		}
	}
}
```

**Repository Pattern** - Direct data access layer:
```typescript
// src/repositories/ExampleRepository.ts
import { eq, and, desc } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import { example } from "~/lib/database/schema";
import type { IEnv } from "~/types";

export class ExampleRepository extends BaseRepository {
	constructor(env: IEnv) {
		super(env);
	}

	async findByUserId(userId: number) {
		return this.env.DB.query.example.findMany({
			where: (example, { eq }) => eq(example.user_id, userId),
			orderBy: (example, { desc }) => [desc(example.created_at)],
		});
	}

	async findActiveByUserId(userId: number) {
		return this.env.DB
			.select()
			.from(example)
			.where(and(eq(example.user_id, userId), eq(example.status, "active")))
			.orderBy(desc(example.created_at));
	}

	async updateStatus(id: string, status: string) {
		const [updated] = await this.env.DB
			.update(example)
			.set({
				status,
				updated_at: sql`(CURRENT_TIMESTAMP)`,
			})
			.where(eq(example.id, id))
			.returning();

		return updated;
	}
}
```

**RepositoryManager** - Centralized access to all repositories:
```typescript
// src/repositories/index.ts
import type { IEnv } from "~/types";

export class RepositoryManager {
	constructor(private env: IEnv) {}

	public get users() {
		return new UserRepository(this.env);
	}

	public get conversations() {
		return new ConversationRepository(this.env);
	}

	public get messages() {
		return new MessageRepository(this.env);
	}

	// ... other repositories
}
```

**Usage in Services:**
```typescript
// PREFERRED: Access repositories through ServiceContext
const entity = await context.repositories.example.findById(id);

// ALTERNATIVE: Direct RepositoryManager usage
const repositories = new RepositoryManager(env);
const entity = await repositories.example.findById(id);

// AVOID: Don't use Database class for simple repository operations
// Instead of: database.getUserById(id)
// Use: database.repositories.users.getUserById(id)
// Or better: context.repositories.users.getUserById(id)
```

### Provider Implementation Pattern

```typescript
// src/lib/providers/provider/example.ts
import { BaseAIProvider } from "./base";
import type {
	ChatCompletionParams,
	ChatCompletionResponse,
	StreamingResponse,
} from "./base";

export class ExampleProvider extends BaseAIProvider {
	name = "example";
	baseURL = "https://api.example.com/v1";

	async generateChatCompletion(
		params: ChatCompletionParams,
	): Promise<ChatCompletionResponse> {
		const { messages, model, temperature = 0.7, max_tokens } = params;

		const response = await fetch(`${this.baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.getApiKey()}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages,
				temperature,
				max_tokens,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(
				`Example provider error: ${response.statusText} - ${error}`,
			);
		}

		return response.json();
	}

	async generateStreamingResponse(
		params: ChatCompletionParams,
	): Promise<Response> {
		const { messages, model, temperature = 0.7 } = params;

		const response = await fetch(`${this.baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.getApiKey()}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages,
				temperature,
				stream: true,
			}),
		});

		if (!response.ok) {
			throw new Error(`Stream error: ${response.statusText}`);
		}

		// Return the streaming response directly
		return new Response(response.body, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	}

	private getApiKey(): string {
		// Implement based on env bindings
		return this.env.EXAMPLE_API_KEY || "";
	}
}
```

## Common Modification Locations

### When user requests...

**"Add authentication to an endpoint"**

- **Files**: `src/middleware/auth.ts` (modify auth logic), route file (apply middleware)
- **Pattern**: Add `allowRestrictedPaths` middleware or create custom auth check
- **Example**: `app.use("/*", async (c, next) => { await allowRestrictedPaths(c, next); })`
- **Tests**: Add tests in `src/middleware/__test__/auth.test.ts`

**"Add rate limiting to an endpoint"**

- **Files**: `src/middleware/rateLimit.ts`, `wrangler.jsonc` (bindings), route file
- **Pattern**: Apply `rateLimit` middleware with appropriate tier (FREE/PRO)
- **Bindings**: Ensure `FREE_RATE_LIMITER` or `PRO_RATE_LIMITER` configured in wrangler.jsonc
- **Example**: `app.post("/example", rateLimit("FREE"), ...)`

**"Add new chat completion feature"**

- **Schema**: `packages/schemas/src/chat.ts` (request/response schemas)
- **Route**: `src/routes/chat.ts` (add endpoint with describeRoute)
- **Service**: `src/services/completions/{feature}.ts` (implement business logic)
- **Provider**: May need to update `src/lib/providers/provider/base.ts` if new capability required
- **Tests**: Add service tests in `src/services/completions/__test__/`

**"Add database table or modify schema"**

- **Schema**: `src/lib/database/schema.ts` (define table using Drizzle)
- **Migration**: Run `pnpm run db:generate` to create migration file
- **Repository**: Create `src/repositories/{Entity}Repository.ts` extending BaseRepository
- **Index**: Export from `src/repositories/index.ts`
- **Tests**: Add repository tests for custom query methods
- **Apply**: Run `pnpm run db:migrate:local` to test locally

**"Add AI provider support"**

- **Provider**: Create `src/lib/providers/provider/{name}.ts` extending BaseAIProvider
- **Factory**: Register in `src/lib/providers/factory.ts` providerConfigs array
- **Models**: Add model definitions to `src/lib/models/index.ts`
- **Usage**: Update `src/lib/usageManager.ts` if pricing/quotas differ
- **Tests**: Mock provider responses and test error handling

**"Improve error handling"**

- **Utilities**: Use `AssistantError` from `src/utils/errors.ts` with appropriate ErrorType
- **Service**: Wrap operations in try-catch, throw AssistantError for known errors
- **Response**: Route handler catches and uses `ResponseFactory.error()` for consistent format
- **Logging**: Use `getLogger()` from `src/utils/logger.ts` to log errors with context

**"Add background task or queue"**

- **Routes**: `src/routes/tasks.ts` (task submission endpoints)
- **Services**: `src/services/tasks/` (TaskService, QueueExecutor, ScheduleExecutor)
- **Bindings**: Configure Queue bindings in `wrangler.jsonc`
- **Pattern**: Tasks submitted to queue are processed asynchronously by QueueExecutor

**"Add middleware"**

- **Create**: `src/middleware/{name}.ts` with middleware function
- **Register**: Import and apply in `src/index.ts` (globally) or specific route file
- **Pattern**: Middleware signature: `async (c: Context, next: Next) => { ... }`
- **Tests**: Add tests in `src/middleware/__test__/{name}.test.ts`

## Error Handling Standards

Always use `AssistantError` with appropriate `ErrorType` for predictable error handling:

```typescript
import { AssistantError, ErrorType } from "~/utils/errors";

// Validation errors
throw new AssistantError(
	"Invalid input: email is required",
	ErrorType.VALIDATION_ERROR,
);

// Authentication errors
throw new AssistantError(
	"Authentication required",
	ErrorType.AUTHENTICATION_ERROR,
);

// Authorization errors
throw new AssistantError(
	"Insufficient permissions",
	ErrorType.AUTHORIZATION_ERROR,
);

// Not found errors
throw new AssistantError("Resource not found", ErrorType.NOT_FOUND);

// Provider/external errors
throw new AssistantError("AI provider unavailable", ErrorType.PROVIDER_ERROR);

// Rate limit errors
throw new AssistantError("Rate limit exceeded", ErrorType.RATE_LIMIT_ERROR);
```

In routes, errors are caught and formatted via `ResponseFactory`:

```typescript
try {
	const result = await handleService(params);
	return ResponseFactory.success(context, result);
} catch (error) {
	if (error instanceof AssistantError) {
		return ResponseFactory.error(context, error.message, error.type);
	}
	return ResponseFactory.error(
		context,
		"Internal server error",
		ErrorType.INTERNAL_ERROR,
	);
}
```

## Testing Requirements

### Before committing changes that:

**Add/modify routes**:

- Add integration tests in route's `__test__/` directory
- Test success cases, validation errors, auth failures
- Mock service layer to isolate route logic

**Add/modify services**:

- Add unit tests in service's `__test__/` directory
- Test business logic with various inputs
- Mock repository and external dependencies
- Test error conditions and edge cases

**Change database schema**:

- Test migration up: `pnpm run db:migrate:local`
- Test migration down: `pnpm run db:migrate:local --down`
- Validate with real data if possible
- Test repository methods against new schema

**Add providers**:

- Mock provider API responses
- Test error handling (network failures, rate limits, invalid responses)
- Test both streaming and non-streaming modes
- Verify monitoring/logging integration

**Change auth/middleware**:

- Test with authenticated users, anonymous users, and no auth
- Test edge cases (expired tokens, invalid credentials)
- Verify middleware chain order

### Test Commands

```bash
pnpm --filter @assistant/api test              # Run all tests
pnpm --filter @assistant/api test {file}       # Run specific test file
pnpm --filter @assistant/api coverage          # Generate coverage report
pnpm --filter @assistant/api test -- --watch   # Watch mode for development
```

### Coverage Requirements

- Maintain existing coverage thresholds (70% global minimum)
- New services should have >80% coverage
- Critical paths (auth, payments, data mutations) should have >90% coverage

## Common Pitfalls & Solutions

### Route Handler Pitfalls

- **Putting business logic in routes**: Extract to services for testability
- **Not using ResponseFactory**: Use for consistent error formatting
- **Missing OpenAPI docs**: Every route needs `describeRoute` for documentation
- **Forgetting validation**: Always use `zValidator` with Zod schemas

### Service Pitfalls

- **Direct database queries**: Use repositories for all database access
- **Not logging errors**: Always use `getLogger()` and log errors with context
- **Swallowing errors**: Let errors propagate to route handler for proper formatting
- **Passing Context objects**: Extract needed values, don't pass raw Hono Context

### Repository Pitfalls

- **Not extending BaseRepository**: Reuse base functionality for common operations
- **Complex logic in repositories**: Keep repositories as data access only
- **Not using transactions**: Use Drizzle transactions for multi-step operations
- **Forgetting indexes**: Add indexes in schema for frequently queried columns

### Provider Pitfalls

- **Hardcoding API keys**: Use env bindings via `this.env`
- **Not handling streaming**: Implement both sync and streaming methods
- **Missing error handling**: Wrap provider calls in try-catch with meaningful errors
- **Not respecting rate limits**: Implement backoff and retry logic

### Migration Pitfalls

- **Hand-editing migrations**: Always use `pnpm run db:generate`
- **Not testing rollback**: Ensure migrations can be safely reversed
- **Breaking changes without coordination**: Coordinate schema changes with frontend
- **Forgetting to apply locally**: Test with `db:migrate:local` before committing

## Guardrails

- Do not hand-edit files under `migrations/`; regenerate via Drizzle CLI.
- Avoid committing secrets: `.dev.vars`, `.wrangler`, and `wrangler.jsonc` contain sensitive data—change them only with maintainer approval.
- Provider implementations live under `src/lib/providers/**`; reuse factory hooks and monitoring helpers when adding new providers.
- Usage limits/constants in `src/constants/app.ts` affect quota logic—coordinate changes with frontend/state owners.
- Keep `src/lib/models/**` configurations consistent with shared schemas and pricing data; update usage manager if costs change.
- Background registrations (`autoRegisterDynamicApps`) run at startup—ensure new services are idempotent.
- Always use `getServiceContext(c)` to extract context in routes; never pass raw Hono Context to services.
- Repository methods should return data only; keep business logic in services.

---

## 📋 AGENTS.md Maintenance Protocol

**IMPORTANT**: When you (the AI agent) make changes to the API, you MUST update this AGENTS.md file immediately after completing the implementation.

### Update Triggers

- ✅ Added new route or endpoint
- ✅ Added new service or repository
- ✅ Added new provider or modified provider architecture
- ✅ Changed database schema or added migration
- ✅ Added new middleware or modified auth logic
- ✅ Discovered common pitfalls or bugs
- ✅ Refactored existing patterns

### What to Update

1. **Implementation Patterns**: Add or update code examples if pattern changed
2. **Common Modification Locations**: Add entry for new feature type
3. **Error Handling Standards**: Document new error types or patterns
4. **Testing Requirements**: Add test requirements for new features
5. **Common Pitfalls**: Document problems encountered and solutions
6. **Guardrails**: Add new constraints or anti-patterns discovered

### Update Format

```markdown
### [Pattern/Feature Name] (Added: YYYY-MM-DD)

**When to use**: [Specific scenario]
**Files**: [File paths]
**Pattern**: [Description]
**Example**: [Code snippet]
**Tests**: [Test requirements]
```

### Review Cycle

- **After every significant change**: Update immediately
- **Before PR submission**: Verify AGENTS.md changes included
- **When patterns evolve**: Remove outdated examples, add new ones

### Why This Matters

Future agents rely on this documentation to:

- Understand API architecture and patterns
- Make consistent changes
- Avoid known pitfalls
- Follow established conventions

**Remember**: Be specific with file paths and include working code examples.
