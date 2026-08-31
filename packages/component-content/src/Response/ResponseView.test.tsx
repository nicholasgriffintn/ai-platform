// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResponseView } from "./ResponseView";
import { TemplateView } from "./TemplateView";
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

  it("renders template markup while stripping anything scriptable from the template itself", () => {
    const { container } = render(
      <TemplateView
        template={[
          '<h2 class="title">{{name}}</h2>',
          "<script>window.pwned = true;</script>",
          '<img src="javascript:alert(1)" onerror="window.pwned = true" alt="logo">',
          '<a href="https://example.com/report">Report</a>',
          "<ul>{{#each tags}}<li>{{this}}</li>{{/each}}</ul>",
        ].join("")}
        data={{ name: "<b>Ada</b>", tags: ["alpha", "beta"] }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("<b>Ada</b>");
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("window.pwned");
    expect(container.querySelector("img")).not.toHaveAttribute("src");
    expect(container.querySelector("img")).toHaveAttribute("alt", "logo");
    expect(screen.getByRole("link", { name: "Report" })).toHaveAttribute(
      "href",
      "https://example.com/report",
    );
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("title");
  });
});
