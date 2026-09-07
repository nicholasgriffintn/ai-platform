import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShellHostProvider, type ShellHost } from "../Host/ShellHostContext";
import type { TaskNotificationChannel } from "../Notifications/task-notification-channel";
import { TaskNotificationSettings } from "./TaskNotificationSettings";

const setCategory = vi.fn();

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  useTaskNotificationPreferences: () => ({
    settings: {
      protocolVersion: 1,
      preferences: {
        enabled: true,
        decisions: true,
        failures: false,
        completions: false,
        assignments: false,
      },
      registrations: [],
      webPushPublicKey: null,
    },
    isLoading: false,
    isUpdating: false,
    refetch: vi.fn(),
    setEnabled: vi.fn(),
    setCategory,
  }),
}));

function renderWithChannel(channel: Partial<TaskNotificationChannel>) {
  const enable = vi.fn();
  const host = {
    webBaseUrl: "https://polychat.test",
    openAssistant: vi.fn(),
    openSignIn: vi.fn(),
    signOut: vi.fn(),
    useTaskNotificationChannel: () => ({
      status: "Ready",
      isDeliverable: true,
      isUnavailable: false,
      error: null,
      isBusy: false,
      enable,
      disable: vi.fn(),
      retry: null,
      ...channel,
    }),
  } satisfies ShellHost;

  render(
    <ShellHostProvider host={host}>
      <TaskNotificationSettings />
    </ShellHostProvider>,
  );

  return { enable };
}

describe("TaskNotificationSettings", () => {
  it("lets a host that delivers without a push subscription choose categories", () => {
    renderWithChannel({ status: "This device raises task notifications." });

    expect(screen.getByLabelText("Decisions and approvals")).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Meaningful failures"));

    expect(setCategory).toHaveBeenCalledWith("failures", true);
  });

  it("keeps categories out of reach until the host can deliver", () => {
    renderWithChannel({ isDeliverable: false });

    expect(screen.getByLabelText("Decisions and approvals")).toBeDisabled();
  });

  it("refuses the switch on a host that cannot deliver at all", () => {
    renderWithChannel({
      isDeliverable: false,
      isUnavailable: true,
      status: "This browser does not support push notifications.",
    });

    expect(screen.getByLabelText("Task notifications")).toBeDisabled();
    expect(screen.getByText("This browser does not support push notifications.")).toBeVisible();
  });
});
