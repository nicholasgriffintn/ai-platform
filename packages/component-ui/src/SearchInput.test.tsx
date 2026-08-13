import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
	it("clears the query and returns focus to the search field", () => {
		const onChange = vi.fn();

		render(<SearchInput aria-label="Search notes" value="roadmap" onChange={onChange} />);

		const input = screen.getByRole("searchbox", { name: "Search notes" });
		const clearButton = screen.getByRole("button", { name: "Clear search" });

		fireEvent.click(clearButton);

		expect(onChange).toHaveBeenCalledWith("");
		expect(input).toHaveFocus();
	});
});
