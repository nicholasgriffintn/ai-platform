import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MAIN_CONTENT_ID, SidebarLayout } from "./SidebarLayout";

afterEach(() => {
  cleanup();
});

function renderShell() {
  return render(
    <SidebarLayout sidebarContent={null} displayNavBar={false}>
      <p>Conversation</p>
    </SidebarLayout>,
  );
}

describe("SidebarLayout", () => {
  it("exposes a single main landmark holding the page content", () => {
    renderShell();

    const landmarks = screen.getAllByRole("main");

    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]).toHaveAttribute("id", MAIN_CONTENT_ID);
    expect(landmarks[0]).toContainElement(screen.getByText("Conversation"));
  });

  it("offers a skip link that targets the main landmark before the sidebar in tab order", () => {
    renderShell();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const landmark = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", `#${MAIN_CONTENT_ID}`);
    expect(landmark).toHaveAttribute("tabindex", "-1");
    expect(
      skipLink.compareDocumentPosition(landmark) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
