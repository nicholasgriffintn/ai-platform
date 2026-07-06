import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	CompactSettingRange,
	CompactSettingSelect,
	CompactSettingSwitch,
} from "./CompactSettingControls";

describe("CompactSettingControls", () => {
	it("wires descriptions and disabled state into native compact controls", () => {
		render(
			<>
				<CompactSettingSelect
					id="verbosity"
					label="Verbosity"
					value="medium"
					onChange={vi.fn()}
					options={[{ label: "Medium", value: "medium" }]}
					description="Adjusts how detailed or concise the response should be."
				/>
				<CompactSettingRange
					id="temperature"
					label="Temperature"
					min={0}
					max={2}
					step={0.1}
					value={0.7}
					disabled
					onChange={vi.fn()}
				/>
				<CompactSettingSwitch
					id="use_rag"
					label="Enable RAG"
					checked={false}
					disabled
					onChange={vi.fn()}
					description="RAG stands for Retrieval-Augmented Generation."
				/>
			</>,
		);

		expect(screen.getByLabelText("Verbosity")).toHaveAttribute(
			"aria-describedby",
			"verbosity-description",
		);
		expect(screen.getByLabelText("Temperature")).toBeDisabled();
		expect(screen.getByLabelText("Enable RAG")).toBeDisabled();
		expect(screen.getByLabelText("Enable RAG")).toHaveAttribute(
			"aria-describedby",
			"use_rag-description",
		);
	});
});
