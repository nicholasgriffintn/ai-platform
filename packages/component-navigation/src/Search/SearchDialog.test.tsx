import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type SearchResult, SearchDialog } from "./SearchDialog";

afterEach(cleanup);

const results: SearchResult[] = [
  {
    id: "conversation:1",
    kind: "conversation",
    title: "Launch notes",
    description: "Personal chat",
    href: "/chat/1",
  },
  {
    id: "project:1",
    kind: "project",
    title: "Launch plan",
    description: "Project · Acme",
    href: "/work/w/projects/1",
  },
  {
    id: "conversation:2",
    kind: "conversation",
    title: "Launch retro",
    description: "Launch plan · Acme",
    href: "/work/w/projects/1/chat/2",
  },
];

function renderDialog(onSelect = vi.fn()) {
  render(
    <SearchDialog
      isOpen
      query="launch"
      results={results}
      hasQuery
      hasError={false}
      isLoading={false}
      isUpdating={false}
      onClose={vi.fn()}
      onQueryChange={vi.fn()}
      onSelect={onSelect}
    />,
  );

  return onSelect;
}

describe("SearchDialog filters", () => {
  it("narrows results to one kind and keeps keyboard selection on the filtered list", () => {
    const onSelect = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("Launch plan"),
    ]);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search Polychat" }), { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(results[1], 0, "keyboard");
  });

  it("only offers filters for kinds present in the results", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: /Chats/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Workspaces/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Capabilities/ })).toBeNull();
  });
});
