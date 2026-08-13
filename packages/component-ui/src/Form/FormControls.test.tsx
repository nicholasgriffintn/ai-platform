import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormCheckbox } from "./Checkbox";
import { FormInput } from "./Input";
import { RangeInput } from "./RangeInput";
import { FormSelect } from "./Select";

describe("shared form controls", () => {
	it("generates ids that connect omitted-id labels and descriptions to their controls", () => {
		render(
			<>
				<FormInput
					label="Agent name"
					value=""
					description="Shown in the assistant profile."
					onChange={() => undefined}
				/>
				<FormSelect
					label="Model"
					value="auto"
					description="Used when auto routing is disabled."
					onChange={() => undefined}
					options={[{ label: "Auto", value: "auto" }]}
				/>
				<FormCheckbox
					label="Save memories"
					checked={false}
					description="Allow future chats to use profile memory."
					onChange={() => undefined}
				/>
				<RangeInput
					label="Temperature"
					value={0.7}
					description="Controls response randomness."
					onChange={() => undefined}
				/>
			</>,
		);

		const input = screen.getByRole("textbox", { name: "Agent name" });
		const select = screen.getByRole("combobox", { name: "Model" });
		const checkbox = screen.getByRole("checkbox", { name: "Save memories" });
		const range = screen.getByRole("slider", { name: "Temperature" });

		expect(input.id).not.toBe("");
		expect(input).toHaveAttribute("aria-describedby", `${input.id}-description`);
		expect(screen.getByText("Shown in the assistant profile.")).toHaveAttribute(
			"id",
			`${input.id}-description`,
		);
		expect(select.id).not.toBe("");
		expect(select).toHaveAttribute("aria-describedby", `${select.id}-description`);
		expect(checkbox.id).not.toBe("");
		expect(checkbox).toHaveAttribute("aria-describedby", `${checkbox.id}-description`);
		expect(range.id).not.toBe("");
		expect(range).toHaveAttribute("aria-describedby", `${range.id}-description`);
	});

	it("preserves explicit ids for generated forms and described-by wiring", () => {
		render(
			<FormInput
				id="topic"
				label="Topic"
				value=""
				onChange={() => undefined}
				description="Used to generate the response."
				aria-describedby="topic-error"
			/>,
		);

		const input = screen.getByLabelText("Topic");

		expect(input).toHaveAttribute("id", "topic");
		expect(input).toHaveAttribute("aria-describedby", "topic-error topic-description");
		expect(screen.getByText("Used to generate the response.")).toHaveAttribute(
			"id",
			"topic-description",
		);
	});
});
