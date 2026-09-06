import { expect, it } from "vitest";

import { sandboxPreviewFrameSource } from "../preview-origin";

it("limits embedded previews to the configured wildcard host and uses HTTPS outside local development", () => {
  expect(sandboxPreviewFrameSource("preview.example.com", false)).toBe(
    "https://*.preview.example.com",
  );
  expect(sandboxPreviewFrameSource("preview.example.com", true)).toBe(
    "https://*.preview.example.com",
  );
  expect(sandboxPreviewFrameSource("localhost:8787", true)).toBe("http://*.localhost:8787");
  expect(sandboxPreviewFrameSource("localhost:8787", false)).toBe("https://*.localhost:8787");
});

it.each([
  undefined,
  "",
  "*",
  "*.example.com",
  "example.com/path",
  "example.com?host=other",
  "user@example.com",
  "example.com; script-src *",
  "https://example.com",
])("refuses malformed or policy-widening preview hosts: %s", (host) => {
  expect(sandboxPreviewFrameSource(host, true)).toBeUndefined();
});
