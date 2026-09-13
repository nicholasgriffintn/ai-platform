import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArtifactWorkbenchPanel } from "./ArtifactPanel";

describe("ArtifactWorkbenchPanel", () => {
  it("shows stylesheet source without offering to execute it as a component", () => {
    render(
      <ArtifactWorkbenchPanel
        artifact={{
          identifier: "styles",
          type: "text/css",
          language: "css",
          title: "Styles",
          content: ".example { color: rebeccapurple; }",
        }}
        copied={false}
        onClose={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Styles").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
  });
});
