import { expect, it } from "vitest";

import { computerScreenFrameSource, previewFrameSource } from "../preview-origin.js";

it("limits embedded previews to the configured wildcard host and uses HTTPS outside local development", () => {
  expect(previewFrameSource("preview.example.com", false)).toBe("https://*.preview.example.com");
  expect(previewFrameSource("preview.example.com", true)).toBe("https://*.preview.example.com");
  expect(previewFrameSource("localhost:8787", true)).toBe("http://*.localhost:8787");
  expect(previewFrameSource("localhost:8787", false)).toBe("https://*.localhost:8787");
});

it.each(["*", "user@example.com", "example.com; script-src *", "https://example.com"])(
  "refuses malformed or policy-widening preview hosts: %s",
  (host) => {
    expect(previewFrameSource(host, true)).toBeUndefined();
    expect(computerScreenFrameSource(host, true)).toBeUndefined();
  },
);
