import { describe, expect, it } from "vitest";

import {
	assessModelSyncDiff,
	buildPolychatRequestBody,
	validatePolychatReviewResponse,
} from "../review-model-sync.mjs";

describe("review-model-sync", () => {
	it("skips Polychat when the sync only changes low-value catalogue metadata", () => {
		const assessment = assessModelSyncDiff({
			changedFiles: ["apps/api/src/data-model/models/openai.ts"],
			diff: `diff --git a/apps/api/src/data-model/models/openai.ts b/apps/api/src/data-model/models/openai.ts
@@
-\t\tlastUpdated: "June 1, 2026",
+\t\tlastUpdated: "June 2, 2026",
`,
		});

		expect(assessment.shouldCallPolychat).toBe(false);
		expect(assessment.reasons).toEqual([]);
	});

	it("calls Polychat when the sync adds or removes model entries", () => {
		const assessment = assessModelSyncDiff({
			changedFiles: ["apps/api/src/data-model/models/openai.ts"],
			diff: `diff --git a/apps/api/src/data-model/models/openai.ts b/apps/api/src/data-model/models/openai.ts
@@
+\tcreateModelConfig("gpt-6-mini", PROVIDER, {
+\t\tname: "GPT-6 Mini",
+\t\tmatchingModel: "gpt-6-mini",
+\t}),
`,
		});

		expect(assessment.shouldCallPolychat).toBe(true);
		expect(assessment.reasons).toContain("model_entries_changed");
	});

	it("calls Polychat when router scoring metadata changes", () => {
		const assessment = assessModelSyncDiff({
			changedFiles: ["apps/api/src/data-model/models/deepseek.ts"],
			diff: `diff --git a/apps/api/src/data-model/models/deepseek.ts b/apps/api/src/data-model/models/deepseek.ts
@@
-\t\tincludedInRouter: false,
+\t\tincludedInRouter: true,
`,
		});

		expect(assessment.shouldCallPolychat).toBe(true);
		expect(assessment.reasons).toContain("router_metadata_changed");
	});

	it("rejects Polychat patches outside the allowed router/model surface", () => {
		expect(() =>
			validatePolychatReviewResponse({
				shouldApply: true,
				summary: "Unsafe workflow edit",
				unifiedDiff: `diff --git a/.github/workflows/sync-models-dev.yml b/.github/workflows/sync-models-dev.yml
--- a/.github/workflows/sync-models-dev.yml
+++ b/.github/workflows/sync-models-dev.yml
@@
-permissions:
+permissions:
`,
				decisions: [],
				risks: [],
			}),
		).toThrow(/not allowed/);
	});

	it("builds a strict structured-output Polychat request", () => {
		const body = buildPolychatRequestBody({
			model: "gpt-5.4",
			diff: "diff --git a/apps/api/src/data-model/models/openai.ts b/apps/api/src/data-model/models/openai.ts",
			assessment: {
				shouldCallPolychat: true,
				reasons: ["model_entries_changed"],
				changedFiles: ["apps/api/src/data-model/models/openai.ts"],
			},
		});

		expect(body.stream).toBe(false);
		expect(body.response_format?.json_schema?.strict).toBe(true);
		expect(body.response_format?.json_schema?.schema.required).toContain("unifiedDiff");
		expect(body.messages.at(-1)?.content).toContain("model_entries_changed");
	});
});
