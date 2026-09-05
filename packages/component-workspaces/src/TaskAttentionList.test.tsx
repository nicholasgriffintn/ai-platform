import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskAttentionList } from "./TaskAttentionList";

const item = {
  id: "task-1:v2",
  kind: "approval" as const,
  taskId: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  projectName: "Launch",
  objective: "Approve release",
  detail: "Waiting for an approval",
  conversationId: null,
  since: "2026-09-05T12:00:00.000Z",
  requiresAction: true,
  isRead: false,
  readAt: null,
  deepLink: "/work/workspace-1/projects/project-1/tasks/task-1",
};

describe("TaskAttentionList", () => {
  it("marks an item read when its current-state link opens", () => {
    const onRead = vi.fn();

    render(<TaskAttentionList items={[item]} itemHref={() => "#task"} onRead={onRead} />);

    fireEvent.click(screen.getByRole("link", { name: "Approve release" }));

    expect(onRead).toHaveBeenCalledWith(item);
  });

  it("dismisses an inbox item without invoking its task link", () => {
    const onRead = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TaskAttentionList
        items={[item]}
        itemHref={() => "#task"}
        onRead={onRead}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss Approve release" }));

    expect(onDismiss).toHaveBeenCalledWith(item);
    expect(onRead).not.toHaveBeenCalled();
  });
});
