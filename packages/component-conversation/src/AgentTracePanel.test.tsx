import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentTracePanel } from "./AgentTracePanel";

describe("AgentTracePanel", () => {
  it("shows the authored skill revision used by a tool result", () => {
    render(
      <AgentTracePanel
        entries={[
          {
            id: "tool-result:1",
            type: "tool_result",
            label: "load_skill",
            status: "success",
            detail: "private instructions at resources/internal.md with digest secret-digest",
            provenance: {
              source: "user-authored",
              scope: "project",
              skill: "release-checklist",
              revisionId: "revision-7",
              revision: 7,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("release-checklist · r7")).toBeTruthy();
    expect(document.body.textContent).not.toContain("revision-7");
    expect(document.body.textContent).not.toContain("private instructions");
    expect(document.body.textContent).not.toContain("resources/internal.md");
    expect(document.body.textContent).not.toContain("secret-digest");
  });
});
