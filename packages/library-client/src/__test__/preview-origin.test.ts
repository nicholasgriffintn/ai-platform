import { expect, it } from "vitest";

import { computerScreenFrameSource, previewFrameSource } from "../preview-origin.js";

it("limits embedded previews to the configured wildcard host and uses HTTPS outside local development", () => {
  expect(previewFrameSource("preview.example.com", false)).toBe("https://*.preview.example.com");
  expect(previewFrameSource("preview.example.com", true)).toBe("https://*.preview.example.com");
  expect(previewFrameSource("localhost:8787", true)).toBe("http://*.localhost:8787");
  expect(previewFrameSource("localhost:8787", false)).toBe("https://*.localhost:8787");
});

it("allows the computer screen from the worker origin locally and the wildcard host in production", () => {
  expect(computerScreenFrameSource("computer.polychat.app", false)).toBe(
    "https://*.computer.polychat.app",
  );
  expect(computerScreenFrameSource("localhost:8790", true)).toBe("http://localhost:8790");
  expect(computerScreenFrameSource("127.0.0.1:8790", true)).toBe("http://127.0.0.1:8790");
  expect(computerScreenFrameSource("localhost:8790", false)).toBe("https://localhost:8790");
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
  expect(previewFrameSource(host, true)).toBeUndefined();
  expect(computerScreenFrameSource(host, true)).toBeUndefined();
});
