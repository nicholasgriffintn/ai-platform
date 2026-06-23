import { beforeEach, describe, expect, it, vi } from "vitest";

import { ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS } from "~/lib/artificial-analysis/endpoints";

import { ingestArtificialAnalysisModels, scoreArtificialAnalysisModels } from "../workflow";

const mocks = vi.hoisted(() => ({
	upsertMany: vi.fn(),
	listAll: vi.fn(),
	updateDerivedScores: vi.fn(),
	enqueueTask: vi.fn(),
}));

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(() => ({
			tasks: {},
			artificialAnalysis: {
				upsertMany: mocks.upsertMany,
				listAll: mocks.listAll,
				updateDerivedScores: mocks.updateDerivedScores,
			},
		})),
	},
}));

vi.mock("~/services/tasks/TaskService", () => ({
	TaskService: class {
		public enqueueTask = mocks.enqueueTask;
	},
}));

describe("artificial analysis workflow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches, stores, and schedules scoring one hour after ingest", async () => {
		mocks.upsertMany.mockImplementation(async (records: unknown[]) => records.length);
		mocks.enqueueTask.mockResolvedValue("score-task");
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				status: 200,
				tier: "free",
				intelligence_index_version: 4.1,
				pagination: {
					page: 1,
					page_size: 200,
					total_pages: 1,
					has_more: false,
				},
				data: [
					{
						id: "aa-model-1",
						name: "Example Pro",
						slug: "example-pro",
						model_creator: {
							id: "creator-1",
							name: "Example AI",
							slug: "example-ai",
						},
						evaluations: {
							artificial_analysis_intelligence_index: 72,
							artificial_analysis_coding_index: 61,
							artificial_analysis_agentic_index: 65,
						},
						pricing: {
							price_1m_input_tokens: 0.2,
							price_1m_output_tokens: 2.6,
						},
						performance: {
							median_output_tokens_per_second: 120,
							median_time_to_first_token_seconds: 0.9,
							median_time_to_first_answer_token_seconds: 7.2,
							median_end_to_end_response_time_seconds: 10.1,
						},
					},
				],
			}),
		});

		const result = await ingestArtificialAnalysisModels({
			env: { ARTIFICIAL_ANALYSIS_API_KEY: "aa-key" } as any,
			fetchImpl,
			now: new Date("2026-06-23T10:00:00.000Z"),
			sourceTaskId: "ingest-task",
		});

		expect(result).toEqual({
			storedModels: ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS.length,
			scoringTaskId: "score-task",
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://artificialanalysis.ai/api/v2/language/models/free?page=1",
			expect.objectContaining({
				headers: expect.objectContaining({
					"x-api-key": "aa-key",
				}),
			}),
		);
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://artificialanalysis.ai/api/v2/media/text-to-image/models/free",
			expect.objectContaining({
				headers: expect.objectContaining({
					"x-api-key": "aa-key",
				}),
			}),
		);
		const [storedRecords] = mocks.upsertMany.mock.calls[0];
		expect(storedRecords).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "aa-model-1",
					ingested_at: "2026-06-23T10:00:00.000Z",
				}),
			]),
		);
		expect(storedRecords).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "text_to_image:aa-model-1",
					ingested_at: "2026-06-23T10:00:00.000Z",
				}),
			]),
		);
		expect(mocks.enqueueTask).toHaveBeenCalledWith({
			id: "artificial-analysis-scoring:ingest-task",
			task_type: "artificial_analysis_scoring",
			task_data: {
				sourceTaskId: "ingest-task",
				ingestedAt: "2026-06-23T10:00:00.000Z",
			},
			schedule_type: "scheduled",
			scheduled_at: "2026-06-23T11:00:00.000Z",
			priority: 6,
		});
	});

	it("updates derived strengths and scores for stored analysis rows", async () => {
		mocks.updateDerivedScores.mockResolvedValue(undefined);
		mocks.listAll.mockResolvedValue([
			{
				id: "aa-model-1",
				evaluations: {
					artificial_analysis_intelligence_index: 82,
					artificial_analysis_coding_index: 63,
					artificial_analysis_agentic_index: 71,
				},
				pricing: {
					price_1m_input_tokens: 0.2,
					price_1m_output_tokens: 2.6,
				},
				median_output_tokens_per_second: 130,
				median_time_to_first_token_seconds: 0.7,
			},
		]);

		const result = await scoreArtificialAnalysisModels({
			env: {} as any,
		});

		expect(result).toEqual({ scoredModels: 1 });
		expect(mocks.updateDerivedScores).toHaveBeenCalledWith("aa-model-1", {
			strengths: expect.arrayContaining(["general_knowledge", "coding", "agents", "low_cost"]),
			scores: expect.objectContaining({
				intelligence: 5,
				coding: 4,
				agentic: 4,
				price: 4,
				outputSpeed: 4,
				firstTokenLatency: 4,
			}),
		});
	});
});
