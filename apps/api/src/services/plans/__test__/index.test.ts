import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorType } from "~/utils/errors";
import { getPlanDetails, listPlans } from "../index";

const mockRepositories = {
	plans: {
		getAllPlans: vi.fn(),
		getPlanById: vi.fn(),
	},
};

vi.mock("~/repositories", () => ({
	RepositoryManager: class {
		constructor() {
			return mockRepositories;
		}
	},
}));

describe("Plans Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("listPlans", () => {
		it("should return all plans", async () => {
			const mockPlans = [
				{ id: "1", name: "Basic Plan" },
				{ id: "2", name: "Pro Plan" },
			];
			mockRepositories.plans.getAllPlans.mockResolvedValue(mockPlans);

			const result = await listPlans({ DB: {} } as any);

			expect(mockRepositories.plans.getAllPlans).toHaveBeenCalledOnce();
			expect(result).toEqual(mockPlans);
		});

		it("should handle database errors", async () => {
			mockRepositories.plans.getAllPlans.mockRejectedValue(
				new Error("Database error"),
			);

			await expect(listPlans({ DB: {} } as any)).rejects.toThrow(
				"Database error",
			);
		});
	});

	describe("getPlanDetails", () => {
		it("should return plan details for valid id", async () => {
			const mockPlan = { id: "1", name: "Basic Plan", price: 9.99 };
			mockRepositories.plans.getPlanById.mockResolvedValue(mockPlan);

			const result = await getPlanDetails({ DB: {} } as any, "1");

			expect(mockRepositories.plans.getPlanById).toHaveBeenCalledWith("1");
			expect(result).toEqual(mockPlan);
		});

		it("should throw error for non-existent plan", async () => {
			mockRepositories.plans.getPlanById.mockResolvedValue(null);

			await expect(
				getPlanDetails({ DB: {} } as any, "999"),
			).rejects.toMatchObject({
				message: "Plan not found",
				type: ErrorType.NOT_FOUND,
				name: "AssistantError",
			});
		});

		it("should handle database errors", async () => {
			mockRepositories.plans.getPlanById.mockRejectedValue(
				new Error("Database error"),
			);

			await expect(getPlanDetails({ DB: {} } as any, "1")).rejects.toThrow(
				"Database error",
			);
		});
	});
});
