import { describe, expect, it } from "vitest";

import { mergeChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/request-options";

describe("mergeChatRequestOptions", () => {
	it("retains project metadata when a recipe adds nested options", () => {
		expect(
			mergeChatRequestOptions(
				{ metadata: { project_id: "project-1" }, options: { sandbox: { enabled: false } } },
				{ metadata: { source: "recipe" }, options: { recipe: { id: "daily-weather" } } },
			),
		).toEqual({
			metadata: { project_id: "project-1", source: "recipe" },
			options: {
				recipe: { id: "daily-weather" },
				sandbox: { enabled: false },
			},
		});
	});

	it("returns undefined when neither request contributes options", () => {
		expect(mergeChatRequestOptions(undefined, undefined)).toBeUndefined();
	});
});
