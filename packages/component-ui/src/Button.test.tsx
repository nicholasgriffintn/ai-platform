import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonClassName, ButtonLink, type ButtonVariant } from "./Button";

describe("Button", () => {
  it("keeps destructive actions visibly red", () => {
    render(<Button variant="destructive">Delete all chats</Button>);

    expect(screen.getByRole("button", { name: "Delete all chats" })).toHaveClass(
      "bg-red-800",
      "text-white",
      "hover:bg-red-900",
    );
  });

  it("exposes loading state without adding the spinner to the accessible name", () => {
    render(<Button isLoading>Save changes</Button>);

    const button = screen.getByRole("button", { name: "Save changes" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("renders button-styled navigation as a link", () => {
    render(<ButtonLink href="/conversation/1">Open conversation</ButtonLink>);

    expect(screen.getByRole("link", { name: "Open conversation" })).toHaveAttribute(
      "href",
      "/conversation/1",
    );
  });

  it("gives every variant a hover state in both themes", () => {
    const variants: ButtonVariant[] = [
      "default",
      "primary",
      "secondary",
      "outline",
      "ghost",
      "destructive",
      "icon",
      "iconActive",
      "link",
    ];

    for (const variant of variants) {
      const className = buttonClassName({ variant });

      expect(className, `${variant} has no light hover`).toMatch(/(?<!dark:)\bhover:/);
      expect(className, `${variant} has no dark hover`).toContain("dark:hover:");
    }
  });

  it("gives filled and bordered buttons the same box so a pair lines up", () => {
    render(
      <>
        <Button variant="primary">Try again</Button>
        <Button variant="outline">Back to the nest</Button>
      </>,
    );

    const geometry = ["border", "rounded-md", "min-h-9", "px-4", "py-2"];

    expect(screen.getByRole("button", { name: "Try again" })).toHaveClass(...geometry);
    expect(screen.getByRole("button", { name: "Back to the nest" })).toHaveClass(...geometry);
  });

  it("collapses a header action to its icon on narrow screens", () => {
    render(
      <Button collapseLabel icon={<span data-testid="icon" />} aria-label="Add a task">
        Add a task
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Add a task" });

    expect(button).toHaveClass("min-w-9", "sm:min-w-0", "sm:px-4");
    expect(screen.getByText("Add a task")).toHaveClass("hidden", "sm:inline");
  });

  it("collapses at the breakpoint the caller asks for", () => {
    render(
      <Button collapseLabel="xl" icon={<span data-testid="icon" />} aria-label="New project">
        New project
      </Button>,
    );

    expect(screen.getByRole("button", { name: "New project" })).toHaveClass(
      "min-w-9",
      "xl:min-w-0",
      "xl:px-4",
    );
    expect(screen.getByText("New project")).toHaveClass("hidden", "xl:inline");
  });

  it("opts button-shaped links out of the host anchor underline", () => {
    render(
      <ButtonLink variant="outline" href="/">
        Back to the nest
      </ButtonLink>,
    );

    expect(screen.getByRole("link", { name: "Back to the nest" })).toHaveClass(
      "no-underline",
      "hover:!no-underline",
    );
  });
});
