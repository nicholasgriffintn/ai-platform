import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectBriefCard } from "./index";

afterEach(cleanup);

describe("ProjectBriefCard", () => {
	it("submits the edited brief through the host callback", async () => {
		const onSave = vi.fn(async () => undefined);
		render(<ProjectBriefCard canManage instructions="Initial context" onSave={onSave} />);

		fireEvent.click(screen.getByRole("button", { name: "Edit project brief" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Project brief" }), {
			target: { value: "Updated context" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save brief" }));

		await waitFor(() => expect(onSave).toHaveBeenCalledWith("Updated context"));
		await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
	});

	it("does not expose editing controls without management permission", () => {
		render(<ProjectBriefCard canManage={false} instructions="" onSave={vi.fn()} />);
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("No project instructions have been added.")).toBeTruthy();
	});
});
