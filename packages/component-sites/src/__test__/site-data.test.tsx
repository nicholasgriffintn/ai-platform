import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dataPage } from "../../test/data-page.js";
import { createSitePreviewActions } from "../preview-actions.js";
import { SiteRenderer } from "../SiteRenderer.js";

afterEach(cleanup);

describe("saved site data", () => {
  it("retains input after a failed save, sends numbers, and resets only after success", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Storage changed"))
      .mockResolvedValueOnce(undefined);
    const { container } = render(<SiteRenderer page={dataPage} onDataAction={save} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Review" } });
    fireEvent.change(screen.getByLabelText("Count"), { target: { value: "3" } });
    fireEvent.submit(container.querySelector("form")!);
    await screen.findByRole("alert");
    expect(screen.getByDisplayValue("Review")).toBeTruthy();
    expect(save).toHaveBeenCalledWith({
      action: "createRecord",
      collectionId: "tasks",
      values: { title: "Review", count: 3 },
    });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.queryByDisplayValue("Review")).toBeNull());
  });

  it("preserves the local filter when new records arrive and prevents duplicate submissions", async () => {
    let release: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { container, rerender } = render(
      <SiteRenderer page={dataPage} boundState={{ "/tasks": [] }} onDataAction={save} />,
    );

    fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "Review" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Pending" } });
    fireEvent.submit(container.querySelector("form")!);
    fireEvent.submit(container.querySelector("form")!);
    expect(save).toHaveBeenCalledTimes(1);
    rerender(
      <SiteRenderer
        page={dataPage}
        boundState={{ "/tasks": [{ title: "Review" }] }}
        onDataAction={save}
      />,
    );
    expect(screen.getByDisplayValue("Review")).toBeTruthy();
    await screen.findByText("Review");
    await act(async () => release?.());
  });

  it("rejects actions when a standalone preview has no authenticated parent", async () => {
    const actions = createSitePreviewActions("frame");

    await expect(actions.invoke({ action: "refreshData" })).rejects.toThrow("Sites");
    actions.dispose();
  });
});
