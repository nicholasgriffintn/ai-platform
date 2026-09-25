import type { TrainingModelDefinition } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import {
  HuggingFaceTrainingProvider,
  type HuggingFaceTrainingEnv,
} from "./HuggingFaceTrainingProvider.js";

const REVISION = "830c14022d19d80e3b09a6a3264dc0fd33a55f23";

const MODEL: TrainingModelDefinition = {
  id: "registry-version-1",
  provider: "huggingface",
  family: "huggingface",
  name: "Qwen2.5 0.5B",
  baseModel: "Qwen/Qwen2.5-0.5B-Instruct",
  baseModelRevision: REVISION,
  defaultHyperparameters: {},
};

const ENV: HuggingFaceTrainingEnv = {
  HUGGINGFACE_TOKEN: "hf_secret",
  HUGGINGFACE_NAMESPACE: "acme",
  AWS_ACCESS_KEY_ID: "access",
  AWS_SECRET_ACCESS_KEY: "secret",
  AWS_REGION: "eu-west-2",
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

describe("HuggingFaceTrainingProvider", () => {
  it("submits a pinned job with credentials only in secrets and maps its status", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        id: "job-123",
        dockerImage: "pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime",
        labels: { "polychat-job": "support-lora-v3" },
        environment: {
          BASE_MODEL: MODEL.baseModel,
          OUTPUT_REPO: "acme/support-lora-v3",
          RECIPE: "sft-lora",
        },
        status: { stage: "SCHEDULING", message: null },
      }),
    );
    const provider = new HuggingFaceTrainingProvider(ENV, fetcher);

    const result = await provider.createTrainingJob({
      provider: "huggingface",
      jobName: "support-lora-v3",
      model: MODEL,
      trainingDataS3Uri: "s3://polychat-training/training/datasets/user-7/export.jsonl",
      recipe: "sft-lora",
    });

    const [url, init] = fetcher.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(String(url)).toBe("https://huggingface.co/api/jobs/acme");
    expect(body.environment).toMatchObject({
      BASE_MODEL: MODEL.baseModel,
      BASE_REVISION: REVISION,
      OUTPUT_REPO: "acme/support-lora-v3",
      RECIPE: "sft-lora",
    });
    expect(JSON.stringify(body.environment)).not.toContain("hf_secret");
    expect(JSON.stringify(body.environment)).not.toContain("X-Amz-Signature");
    expect(body.secrets.HF_TOKEN).toBe("hf_secret");
    expect(body.secrets.TRAIN_URL).toContain("X-Amz-Signature");
    expect(body.labels).toEqual({ "polychat-job": "support-lora-v3" });
    expect(result.job).toMatchObject({
      jobName: "support-lora-v3",
      providerJobId: "job-123",
      status: "Pending",
      recipe: "sft-lora",
      outputModelRepository: "acme/support-lora-v3",
    });
  });

  it("refuses to train or serve an unpinned base model", async () => {
    const provider = new HuggingFaceTrainingProvider(ENV, vi.fn<typeof fetch>());
    const unpinned = { ...MODEL, baseModelRevision: undefined };

    await expect(
      provider.createTrainingJob({
        provider: "huggingface",
        jobName: "x",
        model: unpinned,
        trainingDataS3Uri: "s3://bucket/key.jsonl",
      }),
    ).rejects.toThrow(/pinned to a commit/);
    await expect(provider.deployModel({ model: unpinned, deploymentName: "x" })).rejects.toThrow(
      /pinned to a commit/,
    );
  });
});
