import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { handleLogout } from "./sessions";

describe("notification registration logout", () => {
  it("removes only the signed-out installation before clearing the session", async () => {
    const removeRegistration = vi.fn().mockResolvedValue(undefined);
    const context: ServiceContext = Object.assign(Object.create(null), {
      repositories: {
        taskNotifications: { removeRegistration },
      },
    });

    await expect(
      handleLogout({
        context,
        sessionId: null,
        userId: 7,
        notificationInstallationId: "installation-1",
      }),
    ).resolves.toEqual({ success: true });
    expect(removeRegistration).toHaveBeenCalledWith(7, "installation-1");
  });

  it("does not remove another installation when the caller sends no installation identity", async () => {
    const removeRegistration = vi.fn();
    const context: ServiceContext = Object.assign(Object.create(null), {
      repositories: {
        taskNotifications: { removeRegistration },
      },
    });

    await handleLogout({ context, sessionId: null, userId: 7 });

    expect(removeRegistration).not.toHaveBeenCalled();
  });
});
