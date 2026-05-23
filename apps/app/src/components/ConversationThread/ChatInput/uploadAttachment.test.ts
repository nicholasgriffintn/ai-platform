import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadComposerAttachment } from "./uploadAttachment";

const mocks = vi.hoisted(() => ({
	uploadFile: vi.fn(),
}));

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		uploadFile: mocks.uploadFile,
	},
}));

const defaultContext = {
	isImageModel: false,
	isMultimodalModel: false,
	isTextToImageOnlyModel: false,
	supportsAudio: false,
	supportsDocuments: true,
};

describe("uploadComposerAttachment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uploads supported PDFs as document attachments", async () => {
		mocks.uploadFile.mockResolvedValue({
			url: "https://files.test/spec.pdf",
			name: "spec.pdf",
		});

		const result = await uploadComposerAttachment(
			new File(["pdf"], "spec.pdf", { type: "application/pdf" }),
			defaultContext,
		);

		expect(mocks.uploadFile).toHaveBeenCalledWith(expect.any(File), "document");
		expect(result).toEqual({
			attachment: {
				type: "document",
				data: "https://files.test/spec.pdf",
				name: "spec.pdf",
			},
		});
	});

	it("converts code-like files into markdown document attachments", async () => {
		mocks.uploadFile.mockResolvedValue({
			url: "https://files.test/app.ts",
			name: "app.ts",
			type: "markdown_document",
			markdown: "const value = true;",
		});

		const result = await uploadComposerAttachment(
			new File(["const value = true;"], "app.ts", { type: "text/typescript" }),
			defaultContext,
		);

		expect(mocks.uploadFile).toHaveBeenCalledWith(expect.any(File), "code");
		expect(result).toEqual({
			attachment: {
				type: "markdown_document",
				data: "https://files.test/app.ts",
				name: "app.ts",
				markdown: "const value = true;",
			},
		});
	});

	it("rejects uploads for text-to-image-only models", async () => {
		const result = await uploadComposerAttachment(
			new File(["pdf"], "spec.pdf", { type: "application/pdf" }),
			{
				...defaultContext,
				isTextToImageOnlyModel: true,
			},
		);

		expect(mocks.uploadFile).not.toHaveBeenCalled();
		expect(result).toEqual({ error: "This model does not support file uploads" });
	});
});
