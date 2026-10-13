import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

const generateObject = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/context/serviceContext", () => ({
  resolveServiceContext: vi.fn(({ context }) => context),
}));
vi.mock("~/infrastructure/ai", () => ({ ai: { generateObject } }));
vi.mock("~/modules/models/application/resolve", () => ({
  getAuxiliaryModel: async () => ({ model: "aux-model", provider: "workers-ai", effort: "low" }),
}));
vi.mock("~/modules/outputs/application/provenance", () => ({
  createExecutionOutputProvenance: async () => undefined,
}));

import { handleRecordingDetail } from "../get-details";
import { handleRecordingSummarise } from "../summarise";

const USER = { id: 3, plan_id: "pro" } as unknown as IUser;

const notes = {
  summary: "The team agreed the launch plan.",
  decisions: ["Launch on 4 November"],
  actionItems: [{ task: "Book the venue", owner: "Ada", due: "Friday" }],
};

function contextWith(outputs: Record<string, unknown>[]) {
  const createOutput = vi.fn(async (input: Record<string, unknown>) => {
    outputs.push({ kind: input.kind, content: JSON.stringify(input.content) });
  });
  const listGroup = vi.fn(
    async (_owner: unknown, _capability: string, _id: string, kind?: string) =>
      outputs.filter((output) => kind === undefined || output.kind === kind),
  );

  return {
    createOutput,
    context: {
      env: {},
      ensureDatabase: () => undefined,
      repositories: {
        outputs: {
          createOutput,
          listPersonalOutputGroup: listGroup,
          listProjectOutputGroup: listGroup,
        },
      },
    } as unknown as ServiceContext,
  };
}

describe("recording notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateObject.mockResolvedValue({ object: notes });
  });

  it("extracts decisions and action items from the named-speaker transcript", async () => {
    const outputs: Record<string, unknown>[] = [
      { kind: "upload", content: JSON.stringify({ title: "Launch sync" }) },
      {
        kind: "transcribe",
        content: JSON.stringify({
          title: "Launch sync",
          transcriptionData: {
            output: {
              segments: [
                { text: "Let's launch on 4 November.", speaker: "SPEAKER_00" },
                { text: "I'll book the venue by Friday.", speaker: "SPEAKER_01" },
              ],
            },
          },
        }),
      },
    ];
    const { context } = contextWith(outputs);

    const response = await handleRecordingSummarise({
      context,
      user: USER,
      request: { recordingId: "rec-1", speakers: { SPEAKER_00: "Grace", SPEAKER_01: "Ada" } },
    });

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "aux-model",
        prompt: "Grace: Let's launch on 4 November.\nAda: I'll book the venue by Friday.",
      }),
    );
    expect(response).toMatchObject({ content: notes.summary });

    const recording = await handleRecordingDetail({ context, user: USER, recordingId: "rec-1" });

    expect(recording).toMatchObject({
      summary: notes.summary,
      decisions: notes.decisions,
      actionItems: notes.actionItems,
    });
  });

  it("returns stored notes without calling the model again", async () => {
    const outputs: Record<string, unknown>[] = [
      { kind: "summary", content: JSON.stringify({ ...notes, speakers: {} }) },
    ];
    const { context } = contextWith(outputs);

    const response = await handleRecordingSummarise({
      context,
      user: USER,
      request: { recordingId: "rec-1", speakers: {} },
    });

    expect(generateObject).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      data: { decisions: notes.decisions, actionItems: notes.actionItems },
    });
  });
});
