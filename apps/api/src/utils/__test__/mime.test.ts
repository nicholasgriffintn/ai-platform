import { describe, expect, it } from "vitest";

import { getExtensionFromMimeType } from "../mime";

describe("mime", () => {
	it("should resolve common image and audio extensions", () => {
		expect(getExtensionFromMimeType("image/png", "bin")).toBe("png");
		expect(getExtensionFromMimeType("audio/pcm;rate=24000", "bin")).toBe("pcm");
		expect(getExtensionFromMimeType("audio/mpeg", "bin")).toBe("mp3");
	});

	it("should use the fallback for unknown MIME types", () => {
		expect(getExtensionFromMimeType("application/octet-stream", "bin")).toBe("bin");
	});
});
