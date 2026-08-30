import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { hardenSandboxDocument, SandboxIframe } from "./shared";

describe("artifact sandbox isolation", () => {
  it("blocks preview documents from connecting or navigating away", () => {
    const document = hardenSandboxDocument(
      "<!doctype html><html><head></head><body><script>fetch('https://example.com')</script></body></html>",
    );

    expect(document).toContain("default-src 'none'");
    expect(document).toContain(
      "script-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
    );
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain("form-action 'none'");
    expect(document).toContain("navigate-to 'none'");
  });

  it("keeps scripts in an opaque-origin iframe", () => {
    render(
      <SandboxIframe
        documentContent="<html><head></head><body></body></html>"
        iframeKey={0}
        setPreviewError={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Code Preview")).toHaveAttribute("sandbox", "allow-scripts");
    expect(screen.getByTitle("Code Preview")).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.getByTitle("Code Preview")).not.toHaveAttribute(
      "sandbox",
      expect.stringContaining("allow-same-origin"),
    );
  });
});
