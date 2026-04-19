import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetricsHome } from "./index";

describe("MetricsHome", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders the empty state when the metrics API returns no records", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ metrics: [] }),
			}),
		);

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});

		render(<MetricsHome />, {
			wrapper: ({ children }) => (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			),
		});

		expect(
			screen.getByRole("heading", { name: "Polychat Metrics" }),
		).toBeDefined();
		expect(await screen.findByText("No metrics found")).toBeInTheDocument();
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
