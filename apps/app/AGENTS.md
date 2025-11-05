# App Overview

React Router 7 PWA for Polychat with offline storage, dynamic apps, and WebLLM support.

## Directory Highlights

- `src/root.tsx` – App shell, providers, error boundary, dev tools toggle.
- `src/pages/` – Route-based components mapped by React Router file convention.
- `src/components/` – Shared UI, shell, analytics, and captcha integrations.
- `src/lib/api/` – Fetch wrappers, auth helpers, and API service clients.
- `src/state/` – Zustand stores and React contexts for UI, usage, captcha.
- `src/lib/local/` & `src/lib/web-llm.ts` – Offline/local AI services.
- `public/` – Static assets; `build/` & `dist/` are generated via react-router build.
- `react-router.config.ts` – Router build configuration.

## Local Commands

- **Dev server (after schema build)**
  ```sh
  pnpm --filter @assistant/schemas build
  pnpm --filter @assistant/app dev
  ```
- **Build & deploy**
  ```sh
  pnpm --filter @assistant/app build
  pnpm --filter @assistant/app deploy
  ```
- **Type checking & linting**
  ```sh
  pnpm --filter @assistant/app typecheck
  pnpm --filter @assistant/app lint
  pnpm --filter @assistant/app format
  ```
- **Tests**
  ```sh
  pnpm --filter @assistant/app test         # Vitest (jsdom)
  pnpm --filter @assistant/app coverage
  pnpm test:e2e                             # Playwright (root command)
  ```

## Implementation Notes

- `apps/app/src/constants.ts` defines CSP, analytics, API endpoints, and feature flags; update carefully to avoid production regressions.
- Fetch calls must use `lib/api/fetch-wrapper.ts` to ensure CSRF headers and credentials are applied.
- Offline storage flows depend on IndexedDB utilities in `lib/local`; ensure new features degrade gracefully without local persistence.
- WebLLM manager (`lib/web-llm.ts`) maintains singleton state—avoid parallel instantiation.

## Implementation Patterns

### Page Component Pattern

```typescript
// src/pages/example.tsx
import { useLoaderData, useNavigate } from "react-router";
import { exampleService } from "~/lib/api/services/example";
import { useChatStore } from "~/state/stores/chatStore";
import { Button } from "~/components/ui/button";

// Loader for server-side/navigation data fetching
export async function loader() {
	try {
		const data = await exampleService.getData();
		return { data, error: null };
	} catch (error) {
		return { data: null, error: "Failed to load data" };
	}
}

export default function ExamplePage() {
	const { data, error } = useLoaderData<typeof loader>();
	const { state, setState } = useChatStore();
	const navigate = useNavigate();

	const handleAction = async () => {
		try {
			const result = await exampleService.performAction({ id: data.id });
			setState({ lastAction: result });
			navigate("/success");
		} catch (error) {
			console.error("Action failed:", error);
			// Show error to user
		}
	};

	if (error) {
		return <div>Error: {error}</div>;
	}

	return (
		<div className="container mx-auto p-4">
			<h1 className="text-2xl font-bold mb-4">{data.title}</h1>
			<Button onClick={handleAction}>Perform Action</Button>
		</div>
	);
}
```

### API Service Client Pattern

```typescript
// src/lib/api/services/example.ts
import { fetchWrapper } from "../fetch-wrapper";
import { API_BASE_URL } from "~/constants";
import type {
	ExampleRequest,
	ExampleResponse,
	ExampleListResponse,
} from "@assistant/schemas";

/**
 * Example service for managing example resources
 */
export const exampleService = {
	/**
	 * Get all examples
	 */
	async getAll(): Promise<ExampleListResponse> {
		return fetchWrapper(`${API_BASE_URL}/examples`, {
			method: "GET",
		});
	},

	/**
	 * Get example by ID
	 */
	async getData(id: string): Promise<ExampleResponse> {
		return fetchWrapper(`${API_BASE_URL}/examples/${id}`, {
			method: "GET",
		});
	},

	/**
	 * Create new example
	 */
	async create(request: ExampleRequest): Promise<ExampleResponse> {
		return fetchWrapper(`${API_BASE_URL}/examples`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(request),
		});
	},

	/**
	 * Update existing example
	 */
	async update(
		id: string,
		request: Partial<ExampleRequest>,
	): Promise<ExampleResponse> {
		return fetchWrapper(`${API_BASE_URL}/examples/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(request),
		});
	},

	/**
	 * Delete example
	 */
	async delete(id: string): Promise<void> {
		return fetchWrapper(`${API_BASE_URL}/examples/${id}`, {
			method: "DELETE",
		});
	},

	/**
	 * Perform action on example
	 */
	async performAction(request: { id: string }): Promise<ExampleResponse> {
		return fetchWrapper(`${API_BASE_URL}/examples/action`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(request),
		});
	},
};
```

### Zustand Store Pattern

```typescript
// src/state/stores/exampleStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Item {
	id: string;
	name: string;
	status: "active" | "inactive";
}

interface ExampleState {
	items: Item[];
	selectedId: string | null;
	filter: string;
	isLoading: boolean;

	// Actions
	setItems: (items: Item[]) => void;
	addItem: (item: Item) => void;
	updateItem: (id: string, updates: Partial<Item>) => void;
	removeItem: (id: string) => void;
	selectItem: (id: string) => void;
	clearSelection: () => void;
	setFilter: (filter: string) => void;
	setLoading: (isLoading: boolean) => void;

	// Computed/derived values
	getSelectedItem: () => Item | undefined;
	getFilteredItems: () => Item[];
}

export const useExampleStore = create<ExampleState>()(
	persist(
		(set, get) => ({
			// Initial state
			items: [],
			selectedId: null,
			filter: "",
			isLoading: false,

			// Actions
			setItems: (items) => set({ items }),

			addItem: (item) => set((state) => ({ items: [...state.items, item] })),

			updateItem: (id, updates) =>
				set((state) => ({
					items: state.items.map((item) =>
						item.id === id ? { ...item, ...updates } : item,
					),
				})),

			removeItem: (id) =>
				set((state) => ({
					items: state.items.filter((item) => item.id !== id),
					selectedId: state.selectedId === id ? null : state.selectedId,
				})),

			selectItem: (id) => set({ selectedId: id }),

			clearSelection: () => set({ selectedId: null }),

			setFilter: (filter) => set({ filter }),

			setLoading: (isLoading) => set({ isLoading }),

			// Computed values
			getSelectedItem: () => {
				const { items, selectedId } = get();
				return items.find((item) => item.id === selectedId);
			},

			getFilteredItems: () => {
				const { items, filter } = get();
				if (!filter) return items;
				return items.filter((item) =>
					item.name.toLowerCase().includes(filter.toLowerCase()),
				);
			},
		}),
		{
			name: "example-storage", // localStorage key
			partialize: (state) => ({
				// Only persist these fields
				items: state.items,
				filter: state.filter,
			}),
		},
	),
);
```

### Component Pattern

```typescript
// src/components/Example/Example.tsx
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface ExampleProps {
	data: DataType;
	onAction: (id: string) => void | Promise<void>;
	disabled?: boolean;
	className?: string;
}

/**
 * Example component for demonstrating best practices
 */
export function Example({
	data,
	onAction,
	disabled = false,
	className = "",
}: ExampleProps) {
	const [loading, setLoading] = useState(false);
	const [inputValue, setInputValue] = useState("");

	const handleClick = async () => {
		if (disabled || loading) return;

		setLoading(true);
		try {
			await onAction(data.id);
		} catch (error) {
			console.error("Action failed:", error);
			// Could set error state here and display to user
		} finally {
			setLoading(false);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value);
	};

	return (
		<div className={`p-4 border rounded ${className}`}>
			<h3 className="text-lg font-semibold mb-2">{data.title}</h3>
			<p className="text-gray-600 mb-4">{data.description}</p>

			<Input
				value={inputValue}
				onChange={handleInputChange}
				placeholder="Enter value..."
				disabled={loading || disabled}
				className="mb-4"
			/>

			<Button
				onClick={handleClick}
				disabled={disabled || loading}
				aria-label="Perform action"
			>
				{loading ? "Loading..." : "Perform Action"}
			</Button>
		</div>
	);
}
```

### Custom Hook Pattern

```typescript
// src/hooks/useExample.ts
import { useState, useEffect, useCallback } from "react";
import { exampleService } from "~/lib/api/services/example";
import type { ExampleResponse } from "@assistant/schemas";

interface UseExampleOptions {
	autoFetch?: boolean;
	onError?: (error: Error) => void;
}

export function useExample(id: string, options: UseExampleOptions = {}) {
	const { autoFetch = true, onError } = options;
	const [data, setData] = useState<ExampleResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const result = await exampleService.getData(id);
			setData(result);
		} catch (err) {
			const error = err instanceof Error ? err : new Error("Unknown error");
			setError(error);
			onError?.(error);
		} finally {
			setLoading(false);
		}
	}, [id, onError]);

	const refetch = useCallback(() => {
		return fetchData();
	}, [fetchData]);

	useEffect(() => {
		if (autoFetch) {
			fetchData();
		}
	}, [autoFetch, fetchData]);

	return {
		data,
		loading,
		error,
		refetch,
	};
}
```

## Common Modification Locations

### When user requests...

**"Add a new page"**

- **Page**: Create `pages/{name}.tsx` with component + optional loader/action
- **Route**: Add route to `routes.ts`
- **API client**: Create `lib/api/services/{name}.ts` if API calls needed
- **State**: Create `state/stores/{name}Store.ts` if complex state needed
- **Tests**: Add tests in `pages/{name}.test.tsx`

**"Add API integration"**

- **Client**: Create service in `lib/api/services/{name}.ts`
- **Types**: Import from `@assistant/schemas` (rebuild schemas first)
- **Wrapper**: Always use `fetch-wrapper.ts` for auth/CSRF token handling
- **Error handling**: Catch errors and display user-friendly messages
- **Loading states**: Show loading indicators during async operations

**"Add state management"**

- **Store**: Create `state/stores/{name}Store.ts` using Zustand
- **Persistence**: Use `persist` middleware for localStorage
- **Access**: Import and use hook in components: `const { state, actions } = useStore()`
- **Naming**: Name store hook `use{Name}Store` for consistency

**"Add UI component"**

- **Component**: Create `components/{Name}/{Name}.tsx`
- **Tests**: Add `components/{Name}/{Name}.test.tsx`
- **Styles**: Use Tailwind utility classes
- **Shared UI**: Reuse components from `components/ui/` (shadcn/ui)
- **Props**: Define TypeScript interfaces for all props
- **Accessibility**: Include ARIA labels and keyboard navigation

**"Add feature flag or config"**

- **Constants**: Add to `constants.ts`
- **Env var**: Prefix with `VITE_`, add to `.env` and `.env.example`
- **CSP**: Update `CSP` object in constants.ts if external resources needed
- **Usage**: Import from constants, never hardcode values

**"Add offline functionality"**

- **Local storage**: Use utilities in `lib/local/` for IndexedDB operations
- **WebLLM**: Use singleton manager in `lib/web-llm.ts` for local inference
- **Graceful degradation**: Ensure features work without local persistence
- **Sync**: Implement sync logic when connection restored

**"Add custom hook"**

- **Hook**: Create in `hooks/{name}.ts`
- **Naming**: Prefix with `use` (e.g., `useExample`)
- **Reusability**: Extract common logic from components
- **Dependencies**: Manage with useCallback/useMemo to prevent unnecessary rerenders

**"Update CSP for external resource"**

- **File**: `constants.ts` → `CSP` object
- **Directive**: Add domain to appropriate directive (scriptSrc, connectSrc, imgSrc, etc.)
- **Testing**: Verify in browser console that CSP violations are resolved
- **Documentation**: Comment why domain is needed

## State Management Guidelines

### When to use Zustand stores

- Global app state (UI settings, user preferences)
- Cross-page state that needs persistence
- Complex state with multiple update patterns
- State shared across many components

### When to use React Router loaders

- Page-specific data fetched on navigation
- Data that should be refetched on route changes
- Server-side data that can be fetched during navigation
- SEO-critical data

### When to use component state (useState)

- UI-only state (dropdowns, modals, form inputs)
- Temporary state not needed elsewhere
- State that resets when component unmounts
- Local loading/error states

### When to use custom hooks

- Reusable stateful logic
- Complex effects that need cleanup
- Data fetching patterns used in multiple places
- Extracting component logic for testing

## Testing Patterns

### Component Tests

```typescript
// src/components/Example/Example.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Example } from "./Example";

describe("Example Component", () => {
	const mockData = {
		id: "1",
		title: "Test Title",
		description: "Test Description",
	};

	it("renders data correctly", () => {
		render(<Example data={mockData} onAction={jest.fn()} />);

		expect(screen.getByText("Test Title")).toBeInTheDocument();
		expect(screen.getByText("Test Description")).toBeInTheDocument();
	});

	it("calls onAction when button clicked", async () => {
		const mockAction = jest.fn();
		render(<Example data={mockData} onAction={mockAction} />);

		const button = screen.getByRole("button", { name: /perform action/i });
		fireEvent.click(button);

		await waitFor(() => {
			expect(mockAction).toHaveBeenCalledWith("1");
		});
	});

	it("shows loading state during action", async () => {
		const mockAction = jest.fn(
			() => new Promise((resolve) => setTimeout(resolve, 100)),
		);
		render(<Example data={mockData} onAction={mockAction} />);

		const button = screen.getByRole("button");
		fireEvent.click(button);

		expect(screen.getByText("Loading...")).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText("Perform Action")).toBeInTheDocument();
		});
	});
});
```

### API Service Tests

```typescript
// src/lib/api/services/example.test.ts
import { exampleService } from "./example";
import { fetchWrapper } from "../fetch-wrapper";

jest.mock("../fetch-wrapper");

describe("exampleService", () => {
	it("fetches data correctly", async () => {
		const mockData = { id: "1", name: "Test" };
		(fetchWrapper as jest.Mock).mockResolvedValue(mockData);

		const result = await exampleService.getData("1");

		expect(fetchWrapper).toHaveBeenCalledWith(
			expect.stringContaining("/examples/1"),
			expect.objectContaining({ method: "GET" }),
		);
		expect(result).toEqual(mockData);
	});

	it("handles errors gracefully", async () => {
		(fetchWrapper as jest.Mock).mockRejectedValue(new Error("Network error"));

		await expect(exampleService.getData("1")).rejects.toThrow("Network error");
	});
});
```

### Store Tests

```typescript
// src/state/stores/exampleStore.test.ts
import { renderHook, act } from "@testing-library/react";
import { useExampleStore } from "./exampleStore";

describe("exampleStore", () => {
	it("adds item correctly", () => {
		const { result } = renderHook(() => useExampleStore());

		act(() => {
			result.current.addItem({ id: "1", name: "Test", status: "active" });
		});

		expect(result.current.items).toHaveLength(1);
		expect(result.current.items[0].name).toBe("Test");
	});

	it("filters items correctly", () => {
		const { result } = renderHook(() => useExampleStore());

		act(() => {
			result.current.setItems([
				{ id: "1", name: "Apple", status: "active" },
				{ id: "2", name: "Banana", status: "active" },
			]);
			result.current.setFilter("app");
		});

		expect(result.current.getFilteredItems()).toHaveLength(1);
		expect(result.current.getFilteredItems()[0].name).toBe("Apple");
	});
});
```

## Common Pitfalls & Solutions

### API Integration Pitfalls

- **Not using fetch-wrapper**: Always use `lib/api/fetch-wrapper.ts` for authenticated requests (handles CSRF, credentials)
- **Inline API calls**: Create service clients in `lib/api/services/` for reusability and testing
- **Missing error handling**: Always wrap API calls in try-catch and show user feedback
- **Not showing loading states**: Use loading states to indicate async operations in progress

### State Management Pitfalls

- **Everything in Zustand**: Use component state for UI-only concerns
- **Not persisting correctly**: Use `persist` middleware's `partialize` to select what persists
- **Derived state in store**: Use computed getters instead of storing derived values
- **Mutation instead of immutability**: Always return new objects/arrays in state updates

### Component Pitfalls

- **Missing TypeScript types**: Define interfaces for all props and state
- **Accessibility issues**: Include ARIA labels, keyboard navigation, semantic HTML
- **Hardcoded values**: Extract to constants or props
- **Not memoizing callbacks**: Use useCallback for functions passed to children to prevent rerenders

### Styling Pitfalls

- **Inline styles**: Use Tailwind utility classes or CSS modules
- **Forgetting responsive design**: Test on mobile, use Tailwind responsive prefixes
- **Not following design system**: Use shadcn/ui components for consistency
- **CSP violations**: Add external resources to CSP config in constants.ts

### Testing Pitfalls

- **Not testing user interactions**: Test clicks, typing, form submissions
- **Not testing error states**: Test loading, error, and empty states
- **Over-mocking**: Only mock external dependencies, test real component logic
- **Not using testing-library queries**: Use accessible queries (getByRole, getByLabelText)

## Guardrails

- Do not edit generated build artifacts under `build/` or `dist/`.
- Keep React Router data APIs aligned with backend contracts; update shared schemas first when API signatures change.
- Maintain accessibility in new components (Radix UI patterns, keyboard focus).
- When introducing new environment variables, prefix with `VITE_` and document in constants.
- E2E tests assume base URL `http://localhost:5173`; update Playwright config if ports change.
- Always use `fetch-wrapper.ts` for API calls - never use raw `fetch()` for authenticated requests.
- Extract reusable logic to custom hooks or utilities, avoid duplicating code.
- Follow React best practices: immutable state updates, proper dependency arrays, cleanup effects.
- Use TypeScript strictly - avoid `any` types, define proper interfaces.

---

## 📋 AGENTS.md Maintenance Protocol

**IMPORTANT**: When you (the AI agent) make changes to the app, you MUST update this AGENTS.md file immediately after completing the implementation.

### Update Triggers

- ✅ Added new page or route
- ✅ Added new component or updated component patterns
- ✅ Added new state store or modified state management approach
- ✅ Added new API integration or service client
- ✅ Changed routing or navigation patterns
- ✅ Discovered common pitfalls or bugs
- ✅ Refactored existing patterns

### What to Update

1. **Implementation Patterns**: Add or update code examples if pattern changed
2. **Common Modification Locations**: Add entry for new feature type
3. **State Management Guidelines**: Document when to use new state approaches
4. **Testing Patterns**: Add test requirements and examples for new features
5. **Common Pitfalls**: Document problems encountered and solutions
6. **Guardrails**: Add new constraints or anti-patterns discovered

### Update Format

```markdown
### [Pattern/Feature Name] (Added: YYYY-MM-DD)

**When to use**: [Specific scenario]
**Files**: [File paths]
**Pattern**: [Description]
**Example**: [Code snippet]
**Tests**: [Test approach]
```

### Review Cycle

- **After every significant change**: Update immediately
- **Before PR submission**: Verify AGENTS.md changes included
- **When patterns evolve**: Remove outdated examples, add new ones

### Why This Matters

Future agents rely on this documentation to:

- Understand frontend architecture and patterns
- Build consistent UIs
- Manage state appropriately
- Avoid known pitfalls
- Follow React and TypeScript best practices

**Remember**: Include working code examples and explain the "why" behind patterns.
