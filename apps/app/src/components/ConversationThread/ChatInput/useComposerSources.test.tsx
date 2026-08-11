import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useComposerSources } from "./useComposerSources";

const mocks = vi.hoisted(() => ({
	getSource: vi.fn(),
	toastError: vi.fn(),
	useSources: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("~/hooks/useSources", () => ({ useSources: mocks.useSources }));
vi.mock("~/lib/api/sources", () => ({ getSource: mocks.getSource }));

const capabilities = {
	supportsAudio: false,
	supportsDocuments: true,
	supportsImages: true,
};

const personalSource = {
	id: "source-1",
	createdByUserId: 1,
	projectId: null,
	conversationId: null,
	connectionId: null,
	kind: "text",
	title: "Launch brief",
	status: "available",
	content: "Launch in October.",
	provider: null,
	externalUri: null,
	vectorId: null,
	metadata: {},
	file: null,
	createdAt: "2026-08-11T00:00:00.000Z",
	updatedAt: null,
};

describe("useComposerSources", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.useSources.mockReturnValue({
			data: [{ ...personalSource, content: undefined }],
			isLoading: false,
		});
		mocks.getSource.mockResolvedValue(personalSource);
	});

	it("loads and attaches personal sources for personal Chat", async () => {
		const { result } = renderHook(() => useComposerSources({ enabled: true, capabilities }));

		await act(() => result.current.attachSource("source-1"));

		expect(mocks.useSources).toHaveBeenCalledWith({}, { enabled: true });
		expect(result.current.attachments).toEqual([
			expect.objectContaining({ type: "markdown_document", name: "Launch brief" }),
		]);
	});

	it("loads and attaches only sources in the current project", async () => {
		mocks.getSource.mockResolvedValue({ ...personalSource, projectId: "project-1" });
		const { result } = renderHook(() =>
			useComposerSources({ enabled: true, projectId: "project-1", capabilities }),
		);

		await act(() => result.current.attachSource("source-1"));

		expect(mocks.useSources).toHaveBeenCalledWith({ projectId: "project-1" }, { enabled: true });
		expect(result.current.attachments).toHaveLength(1);
	});

	it("rejects a source outside the active chat scope", async () => {
		const { result } = renderHook(() =>
			useComposerSources({ enabled: true, projectId: "project-1", capabilities }),
		);

		await act(() => result.current.attachSource("source-1"));

		expect(result.current.attachments).toEqual([]);
		expect(mocks.toastError).toHaveBeenCalledWith(
			"This source is not available in the current project",
		);
	});
});
