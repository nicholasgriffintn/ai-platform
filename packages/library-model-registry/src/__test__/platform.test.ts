import type { HardwareOption, ModelBudget } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  architectureFromConfig,
  assignSplit,
  canonicaliseRow,
  collectDescendants,
  estimateSizing,
  evaluateGate,
  hardwareFits,
  overlapsAny,
  preflightSpend,
  redactPii,
  wordNgrams,
} from "../index.js";

const L4: HardwareOption = {
  id: "l4",
  label: "L4",
  accelerator: "nvidia-l4",
  count: 1,
  memoryGb: 24,
  hourlyUsd: 0.8,
};

describe("dataset canonicalisation", () => {
  it("builds chat messages from prompt and response columns and from ShareGPT turns", () => {
    expect(
      canonicaliseRow(
        { instruction: "Hi", output: "Hello", sys: "Be kind" },
        {
          shape: "messages",
          columns: { prompt: "instruction", response: "output", system: "sys" },
        },
      ),
    ).toEqual({
      row: {
        messages: [
          { role: "system", content: "Be kind" },
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello" },
        ],
      },
    });
    expect(
      canonicaliseRow(
        {
          conversations: [
            { from: "human", value: "Q" },
            { from: "gpt", value: "A" },
          ],
        },
        { shape: "messages", columns: { messages: "conversations" } },
      ),
    ).toEqual({
      row: {
        messages: [
          { role: "user", content: "Q" },
          { role: "assistant", content: "A" },
        ],
      },
    });
  });

  it("rejects rows that cannot train anything", () => {
    expect(
      canonicaliseRow(
        { messages: [{ role: "user", content: "only a question" }] },
        {
          shape: "messages",
          columns: { messages: "messages" },
        },
      ),
    ).toEqual({ error: "No assistant turn" });
    expect(
      canonicaliseRow(
        { prompt: "p", chosen: "good" },
        {
          shape: "preference",
          columns: { prompt: "prompt", chosen: "chosen", rejected: "rejected" },
        },
      ),
    ).toEqual({ error: "Needs a prompt, a chosen and a rejected reply" });
  });

  it("redacts email addresses and valid card numbers but leaves short numbers", () => {
    expect(redactPii("Write to jo@example.com, card 4111 1111 1111 1111, order 42")).toBe(
      "Write to [EMAIL], card [CARD], order 42",
    );
  });

  it("splits deterministically by hash and keeps eval suites out of training", () => {
    const plan = { validation: 0.1, test: 0, seed: 1 };

    expect(assignSplit("00000000abcdef", plan)).toBe("validation");
    expect(assignSplit("ffffffffabcdef", plan)).toBe("train");

    const suite = wordNgrams(
      "the quick brown fox jumps over the lazy dog near the old river bank today",
      13,
    );

    expect(
      overlapsAny(
        "prefix the quick brown fox jumps over the lazy dog near the old river bank",
        suite,
      ),
    ).toBe(true);
    expect(
      overlapsAny(
        "an entirely different sentence about something else entirely today friends",
        suite,
      ),
    ).toBe(false);
  });
});

describe("deployment sizing", () => {
  const llama8b = architectureFromConfig({
    model_type: "llama",
    num_hidden_layers: 32,
    hidden_size: 4096,
    num_attention_heads: 32,
    num_key_value_heads: 8,
    max_position_embeddings: 131072,
    torch_dtype: "bfloat16",
  });

  it("reads the KV cache shape from config.json", () => {
    expect(llama8b).toMatchObject({ layers: 32, kvHeads: 8, headDim: 128, modelType: "llama" });
    expect(
      estimateSizing({
        parameterCount: 8e9,
        architecture: llama8b,
        quantisation: "none",
        contextLength: 8192,
        concurrency: 1,
      })?.kvBytesPerToken,
    ).toBe(131072);
  });

  it("fits an 8B model on one L4 for a single stream but not for eight", () => {
    const single = estimateSizing({
      parameterCount: 8e9,
      architecture: llama8b,
      quantisation: "none",
      contextLength: 8192,
      concurrency: 1,
    });
    const busy = estimateSizing({
      parameterCount: 8e9,
      architecture: llama8b,
      quantisation: "none",
      contextLength: 8192,
      concurrency: 8,
    });

    expect(hardwareFits(single, L4)).toBe(true);
    expect(hardwareFits(busy, L4)).toBe(false);
  });
});

describe("spend preflight", () => {
  const budget: ModelBudget = {
    id: "b",
    workspaceId: "w",
    projectId: null,
    monthlyLimitUsd: 1000,
    softLimitPercent: 80,
    hardStop: true,
    approvalAboveUsd: 200,
    idlePauseMinutes: null,
    updatedAt: "2026-09-01T00:00:00Z",
    updatedBy: 1,
  };

  it("blocks spend past a hard limit, asks above the approval threshold and warns near the soft limit", () => {
    expect(preflightSpend([{ budget, spentUsd: 900, committedUsd: 50 }], 100).decision).toBe(
      "blocked",
    );
    expect(preflightSpend([{ budget, spentUsd: 0, committedUsd: 0 }], 250).decision).toBe(
      "needs_approval",
    );
    expect(preflightSpend([{ budget, spentUsd: 700, committedUsd: 0 }], 150).decision).toBe("warn");
    expect(preflightSpend([{ budget, spentUsd: 0, committedUsd: 0 }], 50).decision).toBe("allow");
  });
});

describe("promotion gates", () => {
  it("passes only when every threshold is met by the latest run", () => {
    const gate = { suiteId: "s", thresholds: { accuracy: 0.8, format: 0.95 } };

    expect(
      evaluateGate(gate, {
        accuracy: { mean: 0.85, low: 0.8, high: 0.9, n: 50 },
        format: { mean: 0.97, low: 0.95, high: 0.99, n: 50 },
      }).passed,
    ).toBe(true);
    expect(
      evaluateGate(gate, { accuracy: { mean: 0.85, low: 0.8, high: 0.9, n: 50 } }).failures,
    ).toEqual(["format was not scored"]);
    expect(evaluateGate(gate, null).passed).toBe(false);
  });
});

describe("erasure reach", () => {
  it("follows lineage to every derived dataset and model", () => {
    expect(
      collectDescendants(
        [
          { fromVersionId: "raw", toVersionId: "clean", relation: "derived_from" },
          { fromVersionId: "clean", toVersionId: "adapter", relation: "trained_on" },
          { fromVersionId: "adapter", toVersionId: "merged", relation: "merged_from" },
          { fromVersionId: "other", toVersionId: "unrelated", relation: "trained_on" },
        ],
        "raw",
      ).sort(),
    ).toEqual(["adapter", "clean", "merged"]);
  });
});
