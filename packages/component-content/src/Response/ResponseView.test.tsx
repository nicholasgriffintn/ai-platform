// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResponseView } from "./ResponseView";

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
});
