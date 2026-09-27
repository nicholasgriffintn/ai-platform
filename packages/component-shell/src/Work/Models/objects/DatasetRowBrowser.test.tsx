import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatasetRowBrowser } from "./DatasetRowBrowser.js";

const { readRows, excludeRows, eraseRows, openObject } = vi.hoisted(() => ({
  readRows: vi.fn(),
  excludeRows: vi.fn(),
  eraseRows: vi.fn(),
  openObject: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  useDatasetRows: readRows,
  useModelPlatformMutations: () => ({
    excludeRows: { mutateAsync: excludeRows, isPending: false },
    requestErasure: { mutateAsync: eraseRows, isPending: false },
  }),
}));
vi.mock("../ModelsScope.js", () => ({
  useModelsScope: () => ({ workspaceId: "workspace", can: () => true, open: openObject }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  readRows.mockReturnValue({
    data: { rows: [{ index: 0, split: "train", record: { text: "Row" }, flags: [] }], total: 50 },
    isLoading: false,
    error: null,
  });
  excludeRows.mockResolvedValue({ versionId: "derived" });
});

describe("dataset row review", () => {
  it("starts the flagged subset at its first page and clears hidden selections", () => {
    render(<DatasetRowBrowser versionId="source" />);
    fireEvent.click(screen.getByLabelText("Select row 0"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByLabelText("Flagged only"));
    expect(readRows).toHaveBeenLastCalledWith("workspace", "source", {
      split: "train",
      offset: 0,
      limit: 25,
      flaggedOnly: true,
    });
    expect(screen.getByLabelText("Select row 0")).not.toBeChecked();
  });

  it("preserves selections after a failed exclusion and opens the new revision after success", async () => {
    excludeRows.mockRejectedValueOnce(new Error("Save failed"));
    render(<DatasetRowBrowser versionId="source" />);
    fireEvent.click(screen.getByLabelText("Select row 0"));
    fireEvent.click(screen.getByRole("button", { name: "Exclude" }));
    await waitFor(() => expect(excludeRows).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Select row 0")).toBeChecked();
    expect(openObject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Exclude" }));
    await waitFor(() => expect(openObject).toHaveBeenCalledWith("datasets", "derived"));
  });
});
