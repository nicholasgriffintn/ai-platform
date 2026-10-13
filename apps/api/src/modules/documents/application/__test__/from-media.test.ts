import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import { generateDocumentFromMedia } from "../from-media";

const handleTranscribe = vi.hoisted(() => vi.fn());
const generateText = vi.hoisted(() => vi.fn(async () => "# Notes"));

vi.mock("~/modules/audio/application/transcribe", () => ({ handleTranscribe }));
vi.mock("~/modules/audio/application/transcription-input", () => ({
  resolveAuthorisedTranscriptionSource: async () => ({
    kind: "file",
    file: new Blob(["audio"], { type: "audio/mpeg" }),
  }),
}));
vi.mock("~/modules/models/application/resolve", () => ({
  getAuxiliaryModel: async () => ({ model: "aux", provider: "workers-ai", effort: undefined }),
}));
vi.mock("~/infrastructure/ai", () => ({ ai: { generateText } }));

const USER = { id: 7, plan_id: "pro" } as unknown as IUser;
const context = { env: {} } as unknown as ServiceContext;

function request(timestamps: boolean) {
  return generateDocumentFromMedia({
    context,
    user: USER,
    url: "https://api.example/private/audio.mp3",
    outputs: ["concise_summary"],
    documentType: "meeting",
    timestamps,
  });
}

describe("generateDocumentFromMedia timestamps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the transcript with real timestamps when they are requested", async () => {
    handleTranscribe.mockResolvedValue({
      status: "success",
      content: "Welcome everyone. Budget is approved.",
      segments: [
        { start: 0, end: 4, text: "Welcome everyone." },
        { start: 65, end: 70, text: "Budget is approved." },
      ],
    });

    await request(true);

    expect(handleTranscribe).toHaveBeenCalledWith(expect.objectContaining({ timestamps: true }));
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Transcript:\n\n[0:00] Welcome everyone.\n[1:05] Budget is approved.",
      }),
    );
  });

  it("refuses to invent timestamps when the transcription has no timings", async () => {
    handleTranscribe.mockResolvedValue({ status: "success", content: "Untimed words." });

    await expect(request(true)).rejects.toBeInstanceOf(AssistantError);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("keeps the plain transcript when timestamps are off", async () => {
    handleTranscribe.mockResolvedValue({ status: "success", content: "Plain words." });

    await request(false);

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "Transcript:\n\nPlain words." }),
    );
  });
});
