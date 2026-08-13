import { beforeEach, describe, expect, it, vi } from "vitest";

import { UploadService } from "./upload-service";

const mocks = vi.hoisted(() => ({
	fetchApi: vi.fn(),
	returnFetchedData: vi.fn(),
}));

vi.mock("../fetch-wrapper", () => ({
	fetchApi: mocks.fetchApi,
}));

vi.mock("@ngriffin_uk/polychat-library-client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-client")>()),
	returnFetchedData: mocks.returnFetchedData,
}));

describe("UploadService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchApi.mockResolvedValue(new Response(null, { status: 200 }));
		mocks.returnFetchedData.mockResolvedValue({ sourceId: "source-1" });
	});

	it("includes the project scope in file uploads", async () => {
		const service = new UploadService(async () => ({ Authorization: "Bearer token" }));

		await service.uploadFile(
			new File(["image"], "screenshot.png", { type: "image/png" }),
			"image",
			{ projectId: "project-1" },
		);

		const requestInit = mocks.fetchApi.mock.calls[0]?.[1];
		expect(requestInit?.body).toBeInstanceOf(FormData);
		if (!(requestInit?.body instanceof FormData)) {
			throw new Error("Expected upload body to be FormData");
		}
		expect(requestInit.body.get("project_id")).toBe("project-1");
	});
});
