import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IMAGE_POLICY_CLASSIFIER,
  IMAGE_POLICY_REFUSAL,
  IMAGE_POLICY_UNAVAILABLE,
} from "~/modules/generate/domain/image-policy";
import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  decide: vi.fn(),
  downloadFile: vi.fn(),
  trackGuardrailViolation: vi.fn(),
}));

vi.mock("~/infrastructure/ai", () => ({ ai: { decide: mocks.decide } }));
vi.mock("~/infrastructure/storage", () => ({
  StorageService: { forPrivateAssetsEnv: () => ({ downloadFile: mocks.downloadFile }) },
}));
vi.mock("~/infrastructure/telemetry", () => ({
  createMetrics: () => ({ trackGuardrailViolation: mocks.trackGuardrailViolation }),
}));

import { enforceImagePolicy } from "../image-policy";

const IMAGE = "data:image/png;base64,AAAA";
const REQUEST = {
  env: {} as IEnv,
  user: { id: 4 } as IUser,
  surface: "create_image",
  text: "neutral placeholder",
} as const;

function decision(minor: number, intimate: number) {
  return {
    answers: {
      minor_sexualised: { type: "noul", noul: minor },
      intimate_real_person: { type: "noul", noul: intimate },
    },
  };
}

describe("enforceImagePolicy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.decide.mockResolvedValue(decision(0, 0));
  });

  it("allows a request the classifier clears, using the fixed platform classifier", async () => {
    await expect(enforceImagePolicy(REQUEST)).resolves.toBeUndefined();

    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining(IMAGE_POLICY_CLASSIFIER));
    expect(mocks.trackGuardrailViolation).not.toHaveBeenCalled();
  });

  it.each([
    ["minor_sexualised", decision(0.9, 0)],
    ["intimate_real_person", decision(0, 0.9)],
  ])("refuses %s and records it without the request text", async (violation, answer) => {
    mocks.decide.mockResolvedValue(answer);

    await expect(enforceImagePolicy(REQUEST)).rejects.toMatchObject({
      message: IMAGE_POLICY_REFUSAL,
      statusCode: 403,
    });

    const [, details] = mocks.trackGuardrailViolation.mock.calls[0] ?? [];

    expect(details.violations).toEqual([violation]);
    expect(JSON.stringify(mocks.trackGuardrailViolation.mock.calls)).not.toContain(REQUEST.text);
  });

  it("fails closed when the classifier errors", async () => {
    mocks.decide.mockRejectedValue(new Error("Unavailable"));

    await expect(enforceImagePolicy(REQUEST)).rejects.toMatchObject({
      message: IMAGE_POLICY_UNAVAILABLE,
      statusCode: 503,
    });
  });

  it("fails closed when a reference image cannot be read", async () => {
    mocks.downloadFile.mockRejectedValue(new Error("Unreadable"));

    await expect(
      enforceImagePolicy({ ...REQUEST, images: ["https://example.com/reference.png"] }),
    ).rejects.toMatchObject({ message: IMAGE_POLICY_UNAVAILABLE });
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("classifies every reference image past the per-request limit", async () => {
    mocks.decide.mockResolvedValueOnce(decision(0, 0)).mockResolvedValueOnce(decision(0, 0.9));

    await expect(
      enforceImagePolicy({ ...REQUEST, images: Array.from({ length: 5 }, () => IMAGE) }),
    ).rejects.toMatchObject({ message: IMAGE_POLICY_REFUSAL });

    expect(mocks.decide.mock.calls.map(([request]) => request.images.length)).toEqual([4, 1]);
  });

  it("converts stored reference images to the classifier's format", async () => {
    mocks.downloadFile.mockResolvedValue(new Blob(["image"], { type: "image/jpg" }));

    await enforceImagePolicy({ ...REQUEST, images: ["https://example.com/reference.jpg"] });

    expect(mocks.downloadFile).toHaveBeenCalledWith("https://example.com/reference.jpg", 4);
    expect(mocks.decide.mock.calls[0]?.[0].images[0]).toMatch(/^data:image\/jpeg;base64,/);
  });
});
