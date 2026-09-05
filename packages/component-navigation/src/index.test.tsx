import { LinkProvider } from "@ngriffin_uk/polychat-component-ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConversationList,
  ConversationListActions,
  ConversationListControls,
  ConversationListItemActions,
  DEFAULT_CONVERSATION_LIST_FILTERS,
  ProductModeSwitch,
  SidebarSettingsPopover,
} from "./index";

afterEach(cleanup);

const sidebarSettingsProps = {
  account: { name: "N", planLabel: "Pro" },
  isAuthenticated: true,
  isLoading: false,
  links: {
    account: "/profile",
    customisation: "/profile?tab=customisation",
    providers: "/profile?tab=providers",
    billing: "/profile?tab=billing",
    terms: "/terms",
    privacy: "/privacy",
    sourceCode: "https://example.com/source",
  },
  sourceCodeIcon: <span />,
  usage: [],
  onShowKeyboardShortcuts: vi.fn(),
  onSignIn: vi.fn(),
};

describe("SidebarSettingsPopover", () => {
  it("shows a loading state instead of waiting for a first message", async () => {
    render(<SidebarSettingsPopover {...sidebarSettingsProps} isUsageLoading />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings and configuration" }));

    expect(await screen.findByText("Loading usage…")).toBeTruthy();
    expect(screen.queryByText(/first message/i)).toBeNull();
  });

  it("describes usage without a denominator as tracked rather than unlimited", async () => {
    render(
      <SidebarSettingsPopover
        {...sidebarSettingsProps}
        usage={[
          {
            id: "credits",
            label: "Credits",
            value: "0.1706 used",
            assistiveLabel: "0.1706 credits used this month",
            percentage: null,
            tone: "amber",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open settings and configuration" }));

    expect(await screen.findByText("0.1706 credits used this month")).toBeTruthy();
    expect(screen.queryByText(/unlimited usage/i)).toBeNull();
  });

  it("opens without landing focus on the theme control", async () => {
    render(
      <SidebarSettingsPopover
        {...sidebarSettingsProps}
        theme={{ value: "dark", onChange: vi.fn() }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open settings and configuration" }));

    const dialog = await screen.findByRole("dialog");

    expect(document.activeElement).toBe(dialog);
    expect(screen.getByRole("button", { name: /^Theme/ })).not.toBe(document.activeElement);
  });

  it("changes the theme from a submenu while the popover stays open", async () => {
    const onChange = vi.fn();

    render(
      <SidebarSettingsPopover {...sidebarSettingsProps} theme={{ value: "dark", onChange }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open settings and configuration" }));
    fireEvent.pointerDown(await screen.findByRole("button", { name: /^Theme/ }));

    const current = await screen.findByRole("menuitemradio", { name: "Dark" });

    expect(current.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Fern" }));

    expect(onChange).toHaveBeenCalledWith("fern");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

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
  const sections = [
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

  it("emits selection and hands each conversation to the host for its actions", () => {
    const onSelect = vi.fn();
    const renderItemActions = vi.fn(() => null);

    render(
      <ConversationList
        sections={sections}
        activeConversationId="one"
        isConversationRoute
        onSelect={onSelect}
        renderItemActions={renderItemActions}
      />,
    );

    expect(screen.queryByText("Older")).toBeNull();

    fireEvent.click(screen.getByText("Ideas"));
    expect(onSelect).toHaveBeenCalledWith("two");
    expect(renderItemActions).toHaveBeenCalledWith(
      expect.objectContaining({ id: "one", title: "Roadmap" }),
    );
  });

  it("routes the branch badge back to the parent conversation", () => {
    const onSelect = vi.fn();

    render(<ConversationList sections={sections} isConversationRoute onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText("Go to original conversation"));
    expect(onSelect).toHaveBeenCalledWith("root");
  });

  it("shows conversation-scoped running and action-required states", () => {
    render(
      <ConversationList
        sections={[
          {
            id: "today",
            conversations: [
              { id: "running", title: "Running", isStreaming: true },
              { id: "waiting", title: "Waiting", needsInput: true },
            ],
          },
        ]}
        isConversationRoute
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Response in progress")).toBeTruthy();
    expect(screen.getByLabelText("Action required")).toBeTruthy();
  });
});

describe("ConversationListItemActions", () => {
  const organisation = {
    isPinned: false,
    isUnread: true,
    snooze: null,
    group: null,
    availableGroups: [
      { id: "g1", name: "Platform", scope: { kind: "personal" as const } },
      { id: "g2", name: "Design", scope: { kind: "personal" as const } },
    ],
    canManageGroups: true,
    onTogglePinned: vi.fn(),
    onToggleUnread: vi.fn(),
    onSnooze: vi.fn(),
    onMoveToGroup: vi.fn(),
    onManageGroups: vi.fn(),
  };

  const openMenu = async () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "Conversation actions" }));

    return screen.findByRole("menu");
  };

  it("emits rename and delete intents without owning the data", async () => {
    const onEditTitle = vi.fn();
    const onDelete = vi.fn();

    render(
      <ConversationListItemActions
        conversationId="one"
        title="Roadmap"
        onEditTitle={onEditTitle}
        onDelete={onDelete}
      />,
    );

    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /Pin/ })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onEditTitle).toHaveBeenCalledWith("one", "Roadmap");

    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("one");
  });

  it("offers each organisation intent as its own item with a single-key shortcut", async () => {
    render(
      <ConversationListItemActions
        conversationId="one"
        title="Roadmap"
        organisation={organisation}
        onEditTitle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const menu = await openMenu();

    expect(screen.getByRole("menuitem", { name: "Pin" })).toBeTruthy();
    fireEvent.keyDown(menu, { key: "u" });
    expect(organisation.onToggleUnread).toHaveBeenCalledTimes(1);

    await openMenu();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Mark as read" }), {
      key: "p",
      metaKey: true,
    });
    expect(organisation.onTogglePinned).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "P" });
    expect(organisation.onTogglePinned).toHaveBeenCalledTimes(1);
  });

  it("moves the conversation between the available groups from a submenu", async () => {
    render(
      <ConversationListItemActions
        conversationId="one"
        title="Roadmap"
        organisation={{ ...organisation, group: organisation.availableGroups[0] }}
        onEditTitle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to group" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Design" }));
    expect(organisation.onMoveToGroup).toHaveBeenCalledWith("g2");

    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to group" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "No group" }));
    expect(organisation.onMoveToGroup).toHaveBeenCalledWith(null);

    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to group" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Manage groups…" }));
    expect(organisation.onManageGroups).toHaveBeenCalledTimes(1);
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
