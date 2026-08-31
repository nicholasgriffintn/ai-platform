import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArtifactInlinePreview } from "./ArtifactInlinePreview";

const artifact = {
  identifier: "landing-page",
  type: "text/html",
  language: "html",
  title: "Landing page",
  content: "<main>Hello</main>",
};

afterEach(cleanup);

describe("ArtifactInlinePreview", () => {
  it("covers a preview while its artifact is generating, then reveals it", () => {
    const { rerender } = render(<ArtifactInlinePreview artifact={artifact} isGenerating />);

    expect(screen.getByLabelText("Inline artifact preview: Landing page")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status", { name: "Updating preview" })).toBeVisible();

    rerender(<ArtifactInlinePreview artifact={artifact} />);

    expect(screen.getByLabelText("Inline artifact preview: Landing page")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(screen.queryByRole("status", { name: "Updating preview" })).not.toBeInTheDocument();
  });
});
