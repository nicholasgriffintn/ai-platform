import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextLink } from "./TextLink";

describe("TextLink", () => {
  it("keeps the host anchor underline off until hover", () => {
    render(<TextLink href="/work/1/tasks">Open tasks</TextLink>);

    expect(screen.getByRole("link", { name: "Open tasks" })).toHaveClass(
      "no-underline",
      "hover:!no-underline",
      "border-b",
      "border-transparent",
    );
  });

  it("separates a navigational link from an inline accent link", () => {
    render(
      <>
        <TextLink href="/work/1/members">3 members</TextLink>
        <TextLink href="/terms" tone="accent">
          Terms of Service
        </TextLink>
      </>,
    );

    expect(screen.getByRole("link", { name: "3 members" })).toHaveClass("text-zinc-500");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveClass("text-blue-600");
  });
});
