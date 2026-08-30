import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArtifactPanel } from "./ArtifactPanel";

describe("ArtifactPanel", () => {
  it("shows stylesheet source without offering to execute it as a component", () => {
    render(
      <ArtifactPanel
        artifact={{
          identifier: "styles",
          type: "text/css",
          language: "css",
          title: "Styles",
          content: ".example { color: rebeccapurple; }",
        }}
        copied={false}
        isVisible
        onClose={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Styles" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
  });
});
