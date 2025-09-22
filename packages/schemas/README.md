# @assistant/schemas

Shared Zod schemas for the Assistant application. This package provides reusable type definitions and validation schemas used across the web, API, and other applications in the workspace.

## Installation

This package is part of the monorepo and should be installed via the workspace:

```bash
pnpm install
```

## Usage

```typescript
import { messageSchema, apiResponseSchema } from '@assistant/schemas';

// Use for validation
const result = messageSchema.parse(data);

// Use for TypeScript types
type Message = z.infer<typeof messageSchema>;
```