import { describe, expect, it } from "vitest";

import { ResponseDisplayType } from "~/types/functions";
import {
	formatFunctionName,
	getFunctionIcon,
	getFunctionResponseDisplay,
	getFunctionResponseType,
} from "../functions";

describe("functions", () => {
	describe("formatFunctionName", () => {
		it("should format snake_case to Title Case", () => {
			expect(formatFunctionName("get_user_data")).toBe("Get User Data");
			expect(formatFunctionName("create_new_item")).toBe("Create New Item");
			expect(formatFunctionName("search_documents")).toBe("Search Documents");
		});

		it("should handle single word", () => {
			expect(formatFunctionName("search")).toBe("Search");
			expect(formatFunctionName("create")).toBe("Create");
		});

		it("should handle already formatted names", () => {
			expect(formatFunctionName("Search")).toBe("Search");
			expect(formatFunctionName("GetData")).toBe("GetData");
		});

		it("should handle empty string", () => {
			expect(formatFunctionName("")).toBe("");
		});

		it("should handle names with numbers", () => {
			expect(formatFunctionName("get_user_2fa")).toBe("Get User 2fa");
			expect(formatFunctionName("version_1_api")).toBe("Version 1 Api");
		});
	});

	describe("getFunctionIcon", () => {
		it("should return correct icons for weather functions", () => {
			expect(getFunctionIcon("get_weather")).toBe("cloud");
			expect(getFunctionIcon("weather_forecast")).toBe("cloud");
			expect(getFunctionIcon("check_weather_conditions")).toBe("cloud");
		});

		it("should return correct icons for search functions", () => {
			expect(getFunctionIcon("web_search")).toBe("search");
			expect(getFunctionIcon("search_documents")).toBe("search");
			expect(getFunctionIcon("global_search")).toBe("search");
		});

		it("should return correct icons for image functions", () => {
			expect(getFunctionIcon("generate_image")).toBe("image");
			expect(getFunctionIcon("take_screenshot")).toBe("image");
			expect(getFunctionIcon("process_image")).toBe("image");
		});

		it("should return correct icons for speech functions", () => {
			expect(getFunctionIcon("text_to_speech")).toBe("speech");
			expect(getFunctionIcon("speech_recognition")).toBe("speech");
		});

		it("should return correct icons for video functions", () => {
			expect(getFunctionIcon("create_video")).toBe("video");
			expect(getFunctionIcon("process_video")).toBe("video");
		});

		it("should return correct icons for music functions", () => {
			expect(getFunctionIcon("play_music")).toBe("music");
			expect(getFunctionIcon("generate_music")).toBe("music");
		});

		it("should return correct icons for note functions", () => {
			expect(getFunctionIcon("create_note")).toBe("file-text");
			expect(getFunctionIcon("update_note")).toBe("file-text");
		});

		it("should return correct icons for extract/content functions", () => {
			expect(getFunctionIcon("extract_content")).toBe("file-text");
			expect(getFunctionIcon("get_content")).toBe("file-text");
		});

		it("should return correct icons for create functions", () => {
			expect(getFunctionIcon("create_user")).toBe("plus-circle");
			expect(getFunctionIcon("create_document")).toBe("plus-circle");
		});

		it("should return correct icons for get functions", () => {
			expect(getFunctionIcon("get_data")).toBe("folder-open");
			expect(getFunctionIcon("get_user_info")).toBe("folder-open");
		});

		it("should return correct icons for mcp functions", () => {
			expect(getFunctionIcon("mcp_tool_call")).toBe("file-text");
			expect(getFunctionIcon("mcp_function")).toBe("file-text");
		});

		it("should return correct icons for analyse functions", () => {
			expect(getFunctionIcon("analyse_data")).toBe("file-text");
			expect(getFunctionIcon("analyse_hacker_news")).toBe("file-text");
		});

		it("should return correct icons for workflow functions", () => {
			expect(getFunctionIcon("compose_functions")).toBe("braces");
			expect(getFunctionIcon("if_then_else")).toBe("brain-circuit");
			expect(getFunctionIcon("parallel_execute")).toBe("users");
		});

		it("should return default icon for unknown functions", () => {
			expect(getFunctionIcon("unknown_function")).toBe("app");
			expect(getFunctionIcon("random_name")).toBe("app");
			expect(getFunctionIcon("")).toBe("app");
		});
	});

	describe("getFunctionResponseType", () => {
		it("should return CUSTOM for search functions", () => {
			expect(getFunctionResponseType("web_search")).toBe(
				ResponseDisplayType.CUSTOM,
			);
			expect(getFunctionResponseType("search_documents")).toBe(
				ResponseDisplayType.CUSTOM,
			);
		});

		it("should return TEMPLATE for weather functions", () => {
			expect(getFunctionResponseType("get_weather")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
			expect(getFunctionResponseType("weather_forecast")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
		});

		it("should return TEMPLATE for image functions", () => {
			expect(getFunctionResponseType("generate_image")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
			expect(getFunctionResponseType("take_screenshot")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
		});

		it("should return TEMPLATE for video functions", () => {
			expect(getFunctionResponseType("create_video")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
			expect(getFunctionResponseType("process_video")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
		});

		it("should return TEXT for extract functions", () => {
			expect(getFunctionResponseType("extract_content")).toBe(
				ResponseDisplayType.TEXT,
			);
			expect(getFunctionResponseType("extract_data")).toBe(
				ResponseDisplayType.TEXT,
			);
		});

		it("should return TEXT for speech functions", () => {
			expect(getFunctionResponseType("text_to_speech")).toBe(
				ResponseDisplayType.TEXT,
			);
			expect(getFunctionResponseType("speech_recognition")).toBe(
				ResponseDisplayType.TEXT,
			);
		});

		it("should return TEMPLATE for prompt_coach functions", () => {
			expect(getFunctionResponseType("prompt_coach")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
			expect(getFunctionResponseType("prompt_coach_analyze")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
		});

		it("should return JSON for mcp functions", () => {
			expect(getFunctionResponseType("mcp_tool_call")).toBe(
				ResponseDisplayType.JSON,
			);
			expect(getFunctionResponseType("mcp_function")).toBe(
				ResponseDisplayType.JSON,
			);
		});

		it("should return TEMPLATE for analyse functions", () => {
			expect(getFunctionResponseType("analyse_data")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
			expect(getFunctionResponseType("analyse_hacker_news")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
		});

		it("should return TEMPLATE for workflow functions", () => {
			expect(getFunctionResponseType("compose_functions")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
			expect(getFunctionResponseType("if_then_else")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
			expect(getFunctionResponseType("parallel_execute")).toBe(
				ResponseDisplayType.TEMPLATE,
			);
		});

		it("should return CUSTOM for unknown functions", () => {
			expect(getFunctionResponseType("unknown_function")).toBe(
				ResponseDisplayType.CUSTOM,
			);
			expect(getFunctionResponseType("random_name")).toBe(
				ResponseDisplayType.CUSTOM,
			);
		});
	});

	describe("getFunctionResponseDisplay", () => {
		it("should return default display fields", () => {
			const display = getFunctionResponseDisplay("unknown_function");

			expect(display.fields).toEqual([
				{ key: "status", label: "Status" },
				{ key: "content", label: "Content" },
			]);
		});

		it("should include template for analyse functions", () => {
			const display = getFunctionResponseDisplay("analyse_hacker_news");

			expect(display.template).toBeDefined();
			expect(display.template).toContain("analysis-container");
			expect(display.template).toContain("{{md data.analysis.content}}");
			expect(display.template).toContain("{{#if data.stories}}");
		});

		it("should include template for weather functions", () => {
			const display = getFunctionResponseDisplay("get_weather");

			expect(display.template).toBeDefined();
			expect(display.template).toContain("weather-response");
			expect(display.template).toContain("{{data.main.temp}}");
			expect(display.template).toContain("{{data.weather.0.icon}}");
		});

		it("should include template for image functions", () => {
			const display = getFunctionResponseDisplay("generate_image");

			expect(display.template).toBeDefined();
			expect(display.template).toContain("image-response");
			expect(display.template).toContain("{{data.url}}");
			expect(display.template).toContain("generated-image");
		});

		it("should include template for speech functions", () => {
			const display = getFunctionResponseDisplay("text_to_speech");

			expect(display.template).toBeDefined();
			expect(display.template).toContain("speech-response");
			expect(display.template).toContain("Generated Speech");
		});

		it("should include template for prompt_coach functions", () => {
			const display = getFunctionResponseDisplay("prompt_coach");

			expect(display.template).toBeDefined();
			expect(display.template).toContain("prompt-coach-response");
			expect(display.template).toContain("{{data.analysis}}");
			expect(display.template).toContain("{{data.suggested_prompt}}");
			expect(display.template).toContain("{{data.confidence_score}}");
		});

		it("should include template for workflow functions", () => {
			const display = getFunctionResponseDisplay("compose_functions");

			expect(display.template).toBeDefined();
			expect(display.template).toContain("workflow-response");
			expect(display.template).toContain("workflow-steps");
			expect(display.template).toContain("step-status");
		});

		it("should not include template for non-template functions", () => {
			const display = getFunctionResponseDisplay("web_search");

			expect(display.template).toBeUndefined();
		});

		it("should handle functions with specific template structures", () => {
			const weatherDisplay = getFunctionResponseDisplay("get_weather");
			expect(weatherDisplay.template).toContain("weather-icon");
			expect(weatherDisplay.template).toContain("weather-info");

			const imageDisplay = getFunctionResponseDisplay("generate_image");
			expect(imageDisplay.template).toContain("image-container");

			const coachDisplay = getFunctionResponseDisplay("prompt_coach");
			expect(coachDisplay.template).toContain("suggested-prompt");
			expect(coachDisplay.template).toContain("format-optimization");
		});

		it("should handle analyse functions with all template sections", () => {
			const display = getFunctionResponseDisplay("analyse_data");

			expect(display.template).toContain("analysis-container");
			expect(display.template).toContain("stories-container");
			expect(display.template).toContain("usage-info");
			expect(display.template).toContain(
				"{{data.analysis.usage.total_tokens}}",
			);
		});

		it("should return consistent structure for all functions", () => {
			const functions = [
				"get_weather",
				"web_search",
				"generate_image",
				"text_to_speech",
				"prompt_coach",
				"compose_functions",
				"analyse_data",
				"unknown_function",
			];

			functions.forEach((functionName) => {
				const display = getFunctionResponseDisplay(functionName);

				expect(display).toHaveProperty("fields");
				expect(display.fields).toHaveLength(2);
				expect(display.fields[0]).toEqual({ key: "status", label: "Status" });
				expect(display.fields[1]).toEqual({ key: "content", label: "Content" });
			});
		});
	});

	describe("edge cases", () => {
		it("should handle function names with multiple matching keywords", () => {
			// Function with both "search" and "image" - should prioritize search
			expect(getFunctionIcon("search_image_database")).toBe("search");
			expect(getFunctionResponseType("search_image_database")).toBe(
				ResponseDisplayType.CUSTOM,
			);

			// Function with both "create" and "extract" - should prioritize extract
			expect(getFunctionIcon("extract_and_create_content")).toBe("file-text");
			expect(getFunctionResponseType("extract_and_create_content")).toBe(
				ResponseDisplayType.TEXT,
			);
		});

		it("should handle case sensitivity", () => {
			expect(getFunctionIcon("GET_WEATHER")).toBe("app");
			expect(getFunctionIcon("get_weather")).toBe("cloud");
			expect(getFunctionIcon("Search_Documents")).toBe("app");
			expect(getFunctionIcon("search_documents")).toBe("search");
			expect(getFunctionIcon("CREATE_IMAGE")).toBe("app");
			expect(getFunctionIcon("create_image")).toBe("image");
		});

		it("should handle functions with underscores at start/end", () => {
			expect(formatFunctionName("_get_data_")).toBe(" Get Data ");
			expect(getFunctionIcon("_search_")).toBe("search");
		});
	});
});
