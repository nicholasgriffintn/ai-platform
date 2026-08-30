import { LinkProvider } from "@ngriffin_uk/polychat-component-ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConversationList,
  ConversationListActions,
  ConversationListControls,
  DEFAULT_CONVERSATION_LIST_FILTERS,
  ProductModeSwitch,
} from "./index";

afterEach(cleanup);

describe("ProductModeSwitch", () => {
  it("marks the active mode and links to host-resolved destinations", () => {
    render(<ProductModeSwitch activeMode="work" destinations={{ chat: "/chat", work: "/work" }} />);

    expect(screen.getByRole("link", { name: "Work" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Chat" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Chat" }).getAttribute("href")).toBe("/chat");
  });

  it("renders through the host link component when one is provided", () => {
    const HostLink = forwardRef<HTMLAnchorElement, { href: string }>(function HostLink(
      { href, ...props },
      ref,
    ) {
      return <a ref={ref} data-host-link href={href} {...props} />;
    });

    render(
      <LinkProvider Link={HostLink}>
        <ProductModeSwitch activeMode="chat" destinations={{ chat: "/chat", work: "/work" }} />
      </LinkProvider>,
    );

    expect(screen.getByRole("link", { name: "Chat" }).hasAttribute("data-host-link")).toBe(true);
  });
});

describe("ConversationList", () => {
  const groups = [
    {
      id: "today",
      title: "Today",
      conversations: [
        { id: "one", title: "Roadmap", parentConversationId: "root" },
        { id: "two", title: "Ideas" },
      ],
    },
    { id: "older", title: "Older", conversations: [] },
  ];

  it("emits selection, edit, and delete intents without owning the data", () => {
    const onSelect = vi.fn();
    const onEditTitle = vi.fn();
    const onDelete = vi.fn();

    render(
      <ConversationList
        groups={groups}
        activeConversationId="one"
        isConversationRoute
        onSelect={onSelect}
        onEditTitle={onEditTitle}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByText("Older")).toBeNull();

    fireEvent.click(screen.getByText("Ideas"));
    expect(onSelect).toHaveBeenCalledWith("two");

    fireEvent.click(screen.getAllByLabelText("Edit conversation title")[0]);
    expect(onEditTitle).toHaveBeenCalledWith("one", "Roadmap");

    fireEvent.click(screen.getAllByLabelText("Delete")[0]);
    expect(onDelete).toHaveBeenCalledWith("one");
  });

  it("routes the branch badge back to the parent conversation", () => {
    const onSelect = vi.fn();

    render(
      <ConversationList
        groups={groups}
        isConversationRoute
        onSelect={onSelect}
        onEditTitle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Go to original conversation"));
    expect(onSelect).toHaveBeenCalledWith("root");
  });
});

describe("ConversationListControls", () => {
  it("reports the selected option for the section the reader opens", async () => {
    const onFiltersChange = vi.fn();

    render(
      <ConversationListControls
        filters={DEFAULT_CONVERSATION_LIST_FILTERS}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Conversation list options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Last activity/ }));

    const current = await screen.findByRole("menuitemradio", { name: "Any time" });

    expect(current.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Past 7 days" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ activity: "week" });
  });

  it("offers type grouping alongside date grouping", async () => {
    const onFiltersChange = vi.fn();

    render(
      <ConversationListControls
        filters={DEFAULT_CONVERSATION_LIST_FILTERS}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Conversation list options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Group by/ }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Type" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ groupBy: "type" });
  });

  it("offers a way back to the defaults only once a filter has been changed", async () => {
    const onReset = vi.fn();

    const { rerender } = render(
      <ConversationListControls
        filters={DEFAULT_CONVERSATION_LIST_FILTERS}
        onFiltersChange={vi.fn()}
        onReset={onReset}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Conversation list options" }));
    expect(await screen.findByRole("menuitem", { name: /^Status/ })).toBeTruthy();
    expect(screen.queryByText("Reset to defaults")).toBeNull();

    rerender(
      <ConversationListControls
        filters={{ ...DEFAULT_CONVERSATION_LIST_FILTERS, groupBy: "none" }}
        onFiltersChange={vi.fn()}
        onReset={onReset}
      />,
    );

    fireEvent.click(await screen.findByText("Reset to defaults"));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("ConversationListActions", () => {
  const openMenu = () =>
    fireEvent.pointerDown(screen.getByRole("button", { name: "Conversation list actions" }));

  it("archives the active list and restores the archived one", async () => {
    const onArchiveAll = vi.fn();
    const onRestoreAll = vi.fn();

    const { rerender } = render(
      <ConversationListActions
        archiveFilter="active"
        matchingCount={12}
        onArchiveAll={onArchiveAll}
        onRestoreAll={onRestoreAll}
      />,
    );

    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Archive all (12)" }));
    expect(onArchiveAll).toHaveBeenCalledOnce();

    rerender(
      <ConversationListActions
        archiveFilter="archived"
        matchingCount={3}
        onArchiveAll={onArchiveAll}
        onRestoreAll={onRestoreAll}
      />,
    );

    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Restore all (3)" }));
    expect(onRestoreAll).toHaveBeenCalledOnce();
  });

  it("withholds the bulk action when the count would not describe what changes", async () => {
    const onArchiveAll = vi.fn();

    render(
      <ConversationListActions
        archiveFilter="all"
        matchingCount={12}
        onArchiveAll={onArchiveAll}
        onRestoreAll={vi.fn()}
      />,
    );

    openMenu();

    const action = await screen.findByRole("menuitem", { name: "Archive all" });

    expect(action.getAttribute("data-disabled")).not.toBeNull();

    fireEvent.click(action);
    expect(onArchiveAll).not.toHaveBeenCalled();
  });

  it("has nothing to offer when the filtered list is empty", async () => {
    const onArchiveAll = vi.fn();

    render(
      <ConversationListActions
        archiveFilter="active"
        matchingCount={0}
        onArchiveAll={onArchiveAll}
        onRestoreAll={vi.fn()}
      />,
    );

    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Archive all" }));
    expect(onArchiveAll).not.toHaveBeenCalled();
  });
});
