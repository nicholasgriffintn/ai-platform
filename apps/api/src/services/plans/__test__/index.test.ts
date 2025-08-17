import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { getPlanDetails, listPlans } from "../index";

const mockDatabase = {
  getAllPlans: vi.fn(),
  getPlanById: vi.fn(),
};

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: () => mockDatabase,
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
      mockDatabase.getAllPlans.mockResolvedValue(mockPlans);

      const result = await listPlans({} as any);

      expect(mockDatabase.getAllPlans).toHaveBeenCalledOnce();
      expect(result).toEqual(mockPlans);
    });

    it("should handle database errors", async () => {
      mockDatabase.getAllPlans.mockRejectedValue(new Error("Database error"));

      await expect(listPlans({} as any)).rejects.toThrow("Database error");
    });
  });

  describe("getPlanDetails", () => {
    it("should return plan details for valid id", async () => {
      const mockPlan = { id: "1", name: "Basic Plan", price: 9.99 };
      mockDatabase.getPlanById.mockResolvedValue(mockPlan);

      const result = await getPlanDetails({} as any, "1");

      expect(mockDatabase.getPlanById).toHaveBeenCalledWith("1");
      expect(result).toEqual(mockPlan);
    });

    it("should throw error for non-existent plan", async () => {
      mockDatabase.getPlanById.mockResolvedValue(null);

      await expect(getPlanDetails({} as any, "999")).rejects.toMatchObject({
        message: "Plan not found",
        type: ErrorType.NOT_FOUND,
        name: "AssistantError",
      });
    });

    it("should handle database errors", async () => {
      mockDatabase.getPlanById.mockRejectedValue(new Error("Database error"));

      await expect(getPlanDetails({} as any, "1")).rejects.toThrow(
        "Database error",
      );
    });
  });
});
