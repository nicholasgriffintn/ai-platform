import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteBuildPlaceholder } from "../SiteBuildPlaceholder.js";

describe("SiteBuildPlaceholder", () => {
  it("shows concrete progress while a dashboard is being built", () => {
    render(
      <SiteBuildPlaceholder
        status="streaming"
        patchCount={3}
        plan={{
          kind: "dashboard",
          scope: "page",
          tier: "medium",
          tone: "plain",
          theme: {
            palette: "slate",
            font: "sans",
            radius: "sm",
            mode: "light",
            direction: "utilitarian",
            density: "compact",
            texture: "grid",
            motion: "restrained",
          },
          interactive: true,
          capabilities: ["content", "navigation", "visualisation"],
          confidence: 0.9,
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Building the first visible section · 3 updates",
    );
  });

  it("explains that review happens after the site is ready", () => {
    render(<SiteBuildPlaceholder status="reviewing" patchCount={0} plan={null} />);

    expect(screen.getByRole("status")).toHaveTextContent("The site is ready while Jev checks it");
  });
});
