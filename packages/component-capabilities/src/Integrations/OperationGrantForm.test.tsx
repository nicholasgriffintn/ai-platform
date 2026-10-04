import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OperationGrantForm } from "./OperationGrantForm";

afterEach(cleanup);

describe("project integration grants", () => {
  it("keeps explicit selections while searching and shows removed actions before saving an upgrade", () => {
    const onSave = vi.fn();

    render(
      <OperationGrantForm
        operations={[{ id: "search" }, { id: "send" }]}
        initialOperations={["search", "retired"]}
        canManage
        isSaving={false}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Retired");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "send" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Send" }));
    fireEvent.click(screen.getByRole("button", { name: "Save project access" }));
    expect(onSave).toHaveBeenCalledWith(["search", "send"]);
  });
});
