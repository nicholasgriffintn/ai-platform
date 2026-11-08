import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SandboxIframe } from "./shared";

describe("artifact sandbox isolation", () => {
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
