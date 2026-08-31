import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExperienceRenderer } from "./ExperienceRenderer";

describe("ExperienceRenderer", () => {
  it("rejects the project-only Lean runtime without project context", () => {
    render(
      <ExperienceRenderer
        basePath="/chat/experiences/lean-proofs"
        runtime="lean-proofs"
        subpath=""
      />,
    );

    expect(screen.getByText("Project required")).toBeTruthy();
    expect(screen.getByText(/Work project/)).toBeTruthy();
  });
});
