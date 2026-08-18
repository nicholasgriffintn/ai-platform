import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToolConfigurationDialog } from "./ToolConfigurationDialog";

describe("ToolConfigurationDialog", () => {
  it("saves validated file-search configuration using the API tool contract", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ToolConfigurationDialog
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        tool={{
          id: "file_search",
          capability: "supportsFileSearch",
          category: "Knowledge",
          command: "file search",
          configurationKind: "file_search",
          description: "Search configured vector stores",
          label: "File search",
          requiresConfiguration: true,
        }}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Vector store IDs" }), {
      target: { value: "vs_one\nvs_two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ vectorStoreIds: ["vs_one", "vs_two"] }),
    );
  });
});
