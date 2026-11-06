import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IMAGE_POLICY_CLASSIFIER,
  IMAGE_POLICY_REFUSAL,
  IMAGE_POLICY_UNAVAILABLE,
  REFERENCE_VIDEO_UNREADABLE,
} from "~/modules/generate/domain/image-policy";
import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  decide: vi.fn(),
  downloadFile: vi.fn(),
  fetchFollowingSafeRedirects: vi.fn(),
  getPrivateAssetDataUrl: vi.fn(),
  trackGuardrailViolation: vi.fn(),
}));

vi.mock("~/infrastructure/ai", () => ({ ai: { decide: mocks.decide } }));
vi.mock("~/infrastructure/storage", () => ({
  StorageService: {
    forPrivateAssetsEnv: () => ({
      downloadFile: mocks.downloadFile,
      getPrivateAssetDataUrl: mocks.getPrivateAssetDataUrl,
    }),
  },
}));
vi.mock("@ngriffin_uk/polychat-utility-server/http", () => ({
  fetchFollowingSafeRedirects: mocks.fetchFollowingSafeRedirects,
}));
vi.mock("~/infrastructure/telemetry", () => ({
  createMetrics: () => ({ trackGuardrailViolation: mocks.trackGuardrailViolation }),
}));

import { enforceImagePolicy } from "../image-policy";
import { screenGeneratedImage } from "../image-policy-classifier";

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

  it("sends earlier turns with the request so it cannot be split across them", async () => {
    await enforceImagePolicy({
      ...REQUEST,
      history: [{ role: "user", text: "earlier placeholder" }],
    });

    expect(mocks.decide.mock.calls[0]?.[0].state).toEqual({
      request: REQUEST.text,
      earlier_turns: [{ role: "user", text: "earlier placeholder" }],
    });
  });

  it("classifies a readable reference video", async () => {
    mocks.getPrivateAssetDataUrl.mockResolvedValue(null);
    mocks.fetchFollowingSafeRedirects.mockResolvedValue(
      new Response("video", { headers: { "content-type": "video/mp4" } }),
    );
    mocks.decide.mockResolvedValue(decision(0, 0.9));

    await expect(
      enforceImagePolicy({ ...REQUEST, videos: ["https://example.com/clip.mp4"] }),
    ).rejects.toMatchObject({ message: IMAGE_POLICY_REFUSAL });

    expect(mocks.decide.mock.calls[0]?.[0].videos[0]).toMatch(/^data:video\/mp4;base64,/);
  });

  it.each([
    ["an unsupported format", { "content-type": "video/quicktime" }, "video"],
    ["an oversized file", { "content-type": "video/mp4" }, new Uint8Array(16 * 1024 * 1024 + 1)],
  ])("refuses %s with a clear message", async (_case, headers, body) => {
    mocks.getPrivateAssetDataUrl.mockResolvedValue(null);
    mocks.fetchFollowingSafeRedirects.mockResolvedValue(new Response(body, { headers }));

    await expect(
      enforceImagePolicy({ ...REQUEST, videos: ["https://example.com/clip.mov"] }),
    ).rejects.toMatchObject({ message: REFERENCE_VIDEO_UNREADABLE, statusCode: 400 });
    expect(mocks.decide).not.toHaveBeenCalled();
  });
});

describe("screenGeneratedImage", () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const LARGE = new Uint8Array(4 * 1024 * 1024 + 1);

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.decide.mockResolvedValue(decision(0, 0));
  });

  it("refuses a flagged image", async () => {
    mocks.decide.mockResolvedValue(decision(0.9, 0));

    await expect(
      screenGeneratedImage({ env: {} as IEnv, data: PNG, mimeType: "image/png" }),
    ).rejects.toMatchObject({ message: IMAGE_POLICY_REFUSAL });
  });

  it("recognises an image from its bytes when the type is wrong", async () => {
    await screenGeneratedImage({
      env: {} as IEnv,
      data: PNG,
      mimeType: "application/octet-stream",
    });

    expect(mocks.decide).toHaveBeenCalledTimes(1);
  });

  it("leaves audio alone", async () => {
    await screenGeneratedImage({
      env: {} as IEnv,
      data: new Uint8Array(16),
      mimeType: "audio/mpeg",
    });

    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("fails closed on an oversized image with no way to shrink it", async () => {
    await expect(
      screenGeneratedImage({ env: {} as IEnv, data: LARGE, mimeType: "image/png" }),
    ).rejects.toMatchObject({ message: IMAGE_POLICY_UNAVAILABLE, statusCode: 503 });
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("shrinks an oversized image before classifying it", async () => {
    const output = vi.fn(async () => ({ image: () => new Blob(["small"]).stream() }));
    const transform = vi.fn(() => ({ output }));
    const env = { IMAGES: { input: () => ({ transform }) } } as unknown as IEnv;

    await screenGeneratedImage({ env, data: LARGE, mimeType: "image/png" });

    expect(mocks.decide.mock.calls[0]?.[0].images[0]).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("fails closed when the image cannot be classified", async () => {
    mocks.decide.mockRejectedValue(new Error("Unavailable"));

    await expect(
      screenGeneratedImage({ env: {} as IEnv, data: PNG, mimeType: "image/png" }),
    ).rejects.toMatchObject({ message: IMAGE_POLICY_UNAVAILABLE });
  });
});
