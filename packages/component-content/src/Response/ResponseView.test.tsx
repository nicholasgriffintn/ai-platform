// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResponseView } from "./ResponseView";
import { CouncilMemberPickerView } from "./Views/CouncilMemberPickerView";

describe("ResponseView", () => {
  it("renders formatted text from a failed tool instead of raw markdown or JSON", () => {
    const content = "**Standard error**\n\n```text\nCommand failed\n```\n\nExit code: 1";

    const { container } = render(
      <ResponseView
        result={{
          status: "error",
          content,
          data: { responseType: "text", result: content, providerResult: { return_code: 1 } },
        }}
        responseType="text"
      />,
    );

    expect(screen.getByText("Standard error").tagName).toBe("STRONG");
    expect(screen.getByText("Command failed").tagName).toBe("CODE");
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    expect(container.querySelector('[data-responsetype="error"]')).toBeInTheDocument();
  });

  it("renders a resolved council selection as a compact summary", () => {
    render(
      <CouncilMemberPickerView
        data={{
          members: [
            { id: "sceptic", name: "Sceptic", role: "assumption tester" },
            { id: "architect", name: "Architect", role: "systems designer" },
            { id: "operator", name: "Operator", role: "execution lead" },
          ],
          resolved: true,
          resolution: { memberIds: ["sceptic", "operator"] },
        }}
        embedded={false}
      />,
    );

    expect(screen.getByText("Council convened")).toBeInTheDocument();
    expect(screen.getByText("Sceptic")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(screen.queryByText("Architect")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convene" })).not.toBeInTheDocument();
  });
});
