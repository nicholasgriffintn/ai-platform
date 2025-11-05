# Schemas Overview

Shared Zod schemas and type exports consumed by the API, frontend, and metrics apps.

## Directory Highlights

- `src/*.ts` – Zod schemas grouped by domain (chat, models, tools, auth, etc.).
- `src/index.ts` – Barrel exporting all schema modules.
- `dist/` – Generated build artefacts (CJS, ESM, DTS) produced by `tsup`.
- `tsup.config.ts`, `tsconfig.json` – Build and type-check configuration.
- `package.json` – Exposes workspace entrypoints (`import`/`require`/`types`).

## Commands

- **Build**
  ```sh
  pnpm --filter @assistant/schemas build
  ```
- **Watch / dev**
  ```sh
  pnpm --filter @assistant/schemas dev
  ```
- **Typecheck & lint**
  ```sh
  pnpm --filter @assistant/schemas typecheck
  pnpm --filter @assistant/schemas lint
  pnpm --filter @assistant/schemas format
  ```

## Schema Management Protocol

### When Adding New Schema

1. Create schema file in `src/{domain}.ts` (e.g., `chat.ts`, `models.ts`, `tools.ts`)
2. Define using Zod with proper validation rules
3. Export both the schema and inferred TypeScript type
4. Add to `src/index.ts` barrel export
5. Run `pnpm --filter @assistant/schemas build` to generate types
6. Test in consuming applications (API, app, metrics)
7. Update this AGENTS.md with schema purpose and usage

**Example**:

```typescript
// src/example.ts
import { z } from "zod/v4";

export const exampleRequestSchema = z.object({
	required_field: z.string().min(1, "Required field cannot be empty"),
	optional_field: z.string().optional(),
	number_field: z.number().int().positive(),
	enum_field: z.enum(["option1", "option2", "option3"]),
});

export const exampleResponseSchema = z.object({
	success: z.boolean(),
	data: z.any(),
	message: z.string().optional(),
});

export type ExampleRequest = z.infer<typeof exampleRequestSchema>;
export type ExampleResponse = z.infer<typeof exampleResponseSchema>;
```

### When Modifying Existing Schema

#### Non-Breaking Changes (Safe)

- Adding optional fields with `.optional()`
- Adding fields with `.default()` values
- Making validation less strict (e.g., removing `.min()`)
- Adding new enum values (at the end, if order matters)

**Example**:

```typescript
// ✅ Non-breaking: adding optional field
export const userSchema = z.object({
	name: z.string(),
	email: z.string().email(),
	phone: z.string().optional(), // New optional field - safe
});
```

#### Breaking Changes (Requires Coordination)

- Removing fields
- Renaming fields
- Making optional fields required
- Making validation more strict
- Changing field types
- Removing enum values

**Breaking change checklist**:

1. **Coordinate with all consumers**: Notify API, app, and metrics teams
2. **Plan migration strategy**: Decide if you need a deprecation period
3. **Update all consuming code first**: API routes, services, frontend components
4. **Version if necessary**: Consider creating `{domain}V2Schema` for major changes
5. **Test thoroughly**: Ensure nothing breaks in production
6. **Document in PR**: List all affected areas and migration steps

**Example**:

```typescript
// ❌ Breaking: removing field, making field required
export const userSchema = z.object({
	name: z.string(),
	email: z.string().email(),
	// phone removed - breaking change!
	address: z.string(), // Was optional, now required - breaking change!
});
```

### Schema Patterns

#### Request/Response Pairs

Always create separate schemas for requests and responses:

```typescript
export const createUserRequestSchema = z.object({
	name: z.string(),
	email: z.string().email(),
	password: z.string().min(8),
});

export const createUserResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string(),
	created_at: z.string(),
	// Never return password in response
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;
```

#### Reusable Sub-Schemas

Extract common patterns into reusable schemas:

```typescript
// Common patterns
export const timestampsSchema = z.object({
	created_at: z.string(),
	updated_at: z.string(),
});

export const paginationParamsSchema = z.object({
	page: z.number().int().positive().default(1),
	limit: z.number().int().positive().max(100).default(20),
});

// Use in other schemas
export const userSchema = z
	.object({
		id: z.number(),
		name: z.string(),
		email: z.string().email(),
	})
	.merge(timestampsSchema);
```

#### Validation with Custom Error Messages

Provide clear error messages for better DX:

```typescript
export const emailSchema = z
	.string()
	.min(1, "Email is required")
	.email("Invalid email format");

export const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
	.regex(/[0-9]/, "Password must contain at least one number");
```

#### Discriminated Unions for Polymorphic Data

Use discriminated unions for type-safe polymorphic data:

```typescript
export const textMessageSchema = z.object({
	type: z.literal("text"),
	content: z.string(),
});

export const imageMessageSchema = z.object({
	type: z.literal("image"),
	url: z.string().url(),
	alt: z.string().optional(),
});

export const messageSchema = z.discriminatedUnion("type", [
	textMessageSchema,
	imageMessageSchema,
]);

export type Message = z.infer<typeof messageSchema>;
// TypeScript knows: if (message.type === "text") { message.content }
```

## Consuming Schemas

### In API (Backend)

```typescript
// src/routes/example.ts
import { validator as zValidator } from "hono-openapi";
import {
	exampleRequestSchema,
	exampleResponseSchema,
} from "@assistant/schemas";

app.post("/example", zValidator("json", exampleRequestSchema), async (c) => {
	const body = c.req.valid("json"); // Typed as ExampleRequest
	// ...
});
```

### In App (Frontend)

```typescript
// src/lib/api/services/example.ts
import type { ExampleRequest, ExampleResponse } from "@assistant/schemas";

export const exampleService = {
	async create(request: ExampleRequest): Promise<ExampleResponse> {
		return fetchWrapper("/api/example", {
			method: "POST",
			body: JSON.stringify(request),
		});
	},
};
```

## Common Pitfalls & Solutions

### Schema Pitfalls

- **Forgetting to rebuild**: Always run `pnpm --filter @assistant/schemas build` after changes
- **Breaking changes without coordination**: Coordinate with all consuming apps before breaking changes
- **Not versioning breaking changes**: Consider creating V2 schemas instead of breaking existing ones
- **Missing validation**: Add appropriate constraints (min, max, regex) for better data quality
- **Overly strict validation**: Balance between data quality and user experience

### Export Pitfalls

- **Not exporting types**: Always export both schema and inferred type
- **Missing from index.ts**: Export from barrel file so consumers can import from package root
- **Inconsistent naming**: Follow pattern: `{resource}{Action}Schema` and `{Resource}{Action}`

### Versioning Pitfalls

- **Changing published schemas**: Once in production, prefer adding new versions over modifying
- **Not documenting changes**: Document all schema changes in PR descriptions
- **Forgetting dependent apps**: Check all apps using the schema before making changes

## Contribution Notes

- Keep schemas backward compatible when possible; flag breaking changes in PR descriptions and coordinate with consumers.
- After editing schemas, rebuild (`pnpm --filter @assistant/schemas build`) before running dependent app tests or dev servers.
- Maintain parity with API validation: ensure schemas match `@assistant/schemas` imports used server-side.
- Export new schema modules via `src/index.ts` and update consuming applications if paths change.
- Avoid editing files in `dist/`; they are generated by `tsup`.
- Use semantic naming: `{resource}{Action}RequestSchema` / `{resource}{Action}ResponseSchema`
- Add JSDoc comments to complex schemas explaining their purpose and usage

---

## 📋 AGENTS.md Maintenance Protocol

**IMPORTANT**: When you (the AI agent) make changes to schemas, you MUST update this AGENTS.md file immediately after completing the implementation.

### Update Triggers

- ✅ Added new schema file or domain
- ✅ Made breaking changes to existing schemas
- ✅ Discovered common validation patterns
- ✅ Added new reusable sub-schemas
- ✅ Changed schema organization or structure

### What to Update

1. **Schema Management Protocol**: Add new patterns or best practices discovered
2. **Schema Patterns**: Document reusable patterns for future schemas
3. **Consuming Schemas**: Update if consumer patterns changed
4. **Common Pitfalls**: Add problems encountered and solutions
5. **Breaking Changes Log**: Document what changed and why (optional section)

### Update Format

```markdown
### [Schema Name] (Added/Modified: YYYY-MM-DD)

**Purpose**: [What this schema validates]
**Used by**: [Which apps consume this]
**Breaking changes**: [If any, list them]
**Migration**: [How to migrate if breaking]
```

### Review Cycle

- **After every schema change**: Update immediately
- **Before rebuild**: Document changes first
- **Before PR**: Ensure AGENTS.md reflects all schema updates

### Why This Matters

Schemas are the contract between frontend and backend. Clear documentation:

- Prevents breaking changes from going unnoticed
- Helps consumers understand validation rules
- Provides migration guidance for breaking changes
- Documents the evolution of the API

**Remember**: Schemas are shared by all apps - be extra careful with changes.
