import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listProjectConversationSources } from "~/lib/api/sources";
import { useProjectConversationSources } from "./useProjectConversationSources";

vi.mock("~/lib/api/sources", () => ({
	listProjectConversationSources: vi.fn(),
}));

const capabilities = {
	supportsAudio: true,
	supportsDocuments: true,
	supportsImages: true,
};

describe("useProjectConversationSources", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(listProjectConversationSources).mockResolvedValue([]);
	});

	it("does not load source payloads for an existing conversation", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: PropsWithChildren) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { rerender } = renderHook(
			({ enabled }) => useProjectConversationSources("project-1", capabilities, { enabled }),
			{ initialProps: { enabled: false }, wrapper },
		);

		expect(listProjectConversationSources).not.toHaveBeenCalled();

		rerender({ enabled: true });
		await waitFor(() => expect(listProjectConversationSources).toHaveBeenCalledTimes(1));
	});
});
