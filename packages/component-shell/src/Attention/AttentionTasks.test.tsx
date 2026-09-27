import type { ProjectTaskAttentionItem } from "@ngriffin_uk/polychat-schemas";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttentionPage } from "./AttentionPage.js";

const { tasks, inbox, backgroundQuery, auth } = vi.hoisted(() => {
  const items: ProjectTaskAttentionItem[] = [];
  const inboxState: {
    items: ProjectTaskAttentionItem[];
    unread: number;
    isLoading: boolean;
    error: Error | null;
    markRead: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
  } = {
    items,
    unread: 0,
    isLoading: false,
    error: new Error("Inbox unavailable"),
    markRead: vi.fn(),
    dismiss: vi.fn(),
  };

  return {
    tasks: {
      tasks: [],
      isLoadingTasks: false,
      tasksError: new Error("Background tasks unavailable"),
    },
    inbox: inboxState,
    backgroundQuery: vi.fn(),
    auth: { isAuthenticated: true, isAuthenticationLoading: false, isPro: true },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("../Host/ShellHostContext.js", () => ({
  useShellHost: () => ({ openSignIn: vi.fn() }),
}));

vi.mock("@ngriffin_uk/polychat-library-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-client")>()),
  useChatStore: (
    selector: (state: {
      isAuthenticated: boolean;
      isAuthenticationLoading: boolean;
      isPro: boolean;
    }) => unknown,
  ) => selector(auth),
}));

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  useTaskAttention: () => inbox,
  useTasks: () => {
    backgroundQuery();

    return tasks;
  },
  useWorkAttention: () => ({ data: undefined, isLoading: false, error: null }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAuthenticated = true;
  auth.isAuthenticationLoading = false;
  inbox.error = new Error("Inbox unavailable");
  inbox.items = [];
});

describe("Attention task loading", () => {
  it("reports failed inbox and background queries instead of empty success states", () => {
    render(
      <MemoryRouter>
        <AttentionPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Inbox unavailable")).toBeVisible();
    expect(screen.getByText("Background tasks unavailable")).toBeVisible();
    expect(screen.queryByText("Nothing waiting on you")).toBeNull();
  });
  it("does not request account background tasks before sign-in finishes", () => {
    auth.isAuthenticationLoading = true;
    const { rerender } = render(
      <MemoryRouter>
        <AttentionPage />
      </MemoryRouter>,
    );

    expect(backgroundQuery).not.toHaveBeenCalled();
    auth.isAuthenticationLoading = false;
    auth.isAuthenticated = false;
    rerender(
      <MemoryRouter>
        <AttentionPage />
      </MemoryRouter>,
    );
    expect(backgroundQuery).not.toHaveBeenCalled();
  });

  it("reports receipt failures and leaves the notification available to retry", async () => {
    inbox.error = null;
    inbox.items = [
      {
        id: "notification",
        kind: "review",
        taskId: "task",
        projectId: "project",
        workspaceId: "workspace",
        projectName: "Launch",
        objective: "Review launch",
        detail: null,
        conversationId: null,
        since: "2026-09-25T10:00:00Z",
        requiresAction: true,
        isRead: false,
        readAt: null,
        deepLink: "/work/workspace/projects/project/tasks/task",
      },
    ];
    inbox.dismiss.mockRejectedValueOnce(new Error("Notification update failed"));
    render(
      <MemoryRouter>
        <AttentionPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Review launch" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Notification update failed"));
    expect(screen.getByRole("link", { name: "Review launch" })).toBeVisible();
  });
});
