import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppSchema } from "@assistant/schemas";
import { FormField } from "./FormField";

type DynamicField = AppSchema["formSchema"]["steps"][0]["fields"][0];

describe("FormField", () => {
	it("associates generated help and validation text with the control", () => {
		const field = {
			id: "topic",
			type: "text",
			label: "Topic",
			description: "Describe what the generated app should use.",
			required: true,
		} satisfies DynamicField;

		render(<FormField field={field} value="" onChange={vi.fn()} error="Topic is required" />);

		const input = screen.getByRole("textbox", { name: /Topic/ });

		expect(input).toHaveAttribute("aria-describedby", "topic-description topic-error");
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(screen.getByText("Describe what the generated app should use.")).toHaveAttribute(
			"id",
			"topic-description",
		);
		expect(screen.getByText("Topic is required")).toHaveAttribute("id", "topic-error");
	});

	it("does not leak NaN into controlled number field state", () => {
		const onChange = vi.fn();
		const field = {
			id: "count",
			type: "number",
			label: "Count",
			required: false,
		} satisfies DynamicField;

		const { rerender } = render(<FormField field={field} value={Number.NaN} onChange={onChange} />);

		const input = screen.getByRole("spinbutton", { name: "Count" });
		expect(input).toHaveValue(null);

		fireEvent.change(input, { target: { value: "12.5" } });
		rerender(<FormField field={field} value={12.5} onChange={onChange} />);
		fireEvent.change(input, { target: { value: "" } });

		expect(onChange).toHaveBeenNthCalledWith(1, "count", 12.5);
		expect(onChange).toHaveBeenNthCalledWith(2, "count", "");
	});
});
