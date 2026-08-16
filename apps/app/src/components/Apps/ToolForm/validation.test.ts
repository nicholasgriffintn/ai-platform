import { describe, expect, it } from "vitest";

import {
	getToolFormErrors,
	getToolFormStepErrors,
	type RenderableTool,
} from "@ngriffin_uk/polychat-schemas";

const app: RenderableTool = {
	id: "example",
	name: "Example",
	description: "Example dynamic app",
	formSchema: {
		steps: [
			{
				id: "details",
				title: "Details",
				fields: [
					{
						id: "topic",
						type: "text",
						label: "Topic",
						required: true,
						validation: {
							minLength: 3,
						},
					},
					{
						id: "tone",
						type: "select",
						label: "Tone",
						required: false,
						validation: {
							options: [
								{ label: "Direct", value: "direct" },
								{ label: "Warm", value: "warm" },
							],
						},
					},
				],
			},
		],
	},
	responseSchema: {
		type: "json",
		display: {},
	},
};

describe("dynamic app form validation", () => {
	it("returns field-level step errors for required fields and validation constraints", () => {
		expect(getToolFormStepErrors(app.formSchema.steps[0], { topic: "AI", tone: "cold" })).toEqual({
			topic: "Topic must be at least 3 characters",
			tone: "Tone has an invalid option",
		});
	});

	it("flags unknown submitted fields for API-side validation", () => {
		expect(getToolFormErrors(app, { topic: "Agents", extra: "ignored" })).toEqual({
			extra: "Unknown field extra in form data",
		});
	});
});
