import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";

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
});
