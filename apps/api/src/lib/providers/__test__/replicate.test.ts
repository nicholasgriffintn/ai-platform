import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { ReplicateProvider, buildReplicateInput } from "../provider/replicate";

vi.mock("~/lib/providers/base", () => ({
  BaseProvider: class MockBaseProvider {
    name = "mock";
    supportsStreaming = true;
    validateParams() {}
    async getApiKey() {
      return "test-key";
    }
  },
}));

vi.mock("~/lib/models", () => ({
  getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({}));

global.fetch = vi.fn();

describe("ReplicateProvider", () => {
  describe("mapParameters", () => {
    it("should construct input payload using schema defaults and prompt", async () => {
      // @ts-ignore - mocked implementation
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel: "replicate-model",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "num_outputs", type: "integer", default: 1 },
          ],
        },
      });

      const provider = new ReplicateProvider();

      const params = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        completion_id: "test-completion-id",
      };

      const result = await provider.mapParameters(params as any);

      expect(result).toEqual({
        version: "replicate-model",
        input: {
          prompt: "Hello",
          num_outputs: 1,
        },
      });
    });

    it("should include enumerated options from params", async () => {
      // @ts-ignore - mocked implementation
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel: "replicate-model",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            {
              name: "model_version",
              type: "string",
              enum: ["melody", "medium"],
              default: "melody",
            },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Compose" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        model_version: "medium",
      };

      const result = await provider.mapParameters(params as any);

      expect(result).toEqual({
        version: "replicate-model",
        input: {
          prompt: "Compose",
          model_version: "medium",
        },
      });
    });
  });

  describe("buildReplicateInput", () => {
    it("should throw when enum value is invalid", () => {
      const params: any = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Prompt" }],
        env: { AI_GATEWAY_TOKEN: "token" },
        model_version: "invalid",
      };

      const config: any = {
        matchingModel: "replicate-model",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "model_version", type: "string", enum: ["melody"] },
          ],
        },
      };

      expect(() => buildReplicateInput(params, config)).toThrow(
        'Invalid value "invalid" for field "model_version"',
      );
    });
  });

  describe("validateParams", () => {
    it("should validate required parameters", async () => {
      const provider = new ReplicateProvider();

      const paramsMissingKey = {
        model: "replicate-model",
        messages: [{ role: "user", content: "Hello" }],
        env: {},
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsMissingKey as any);
      }).toThrow("Missing AI_GATEWAY_TOKEN");

      const paramsWithoutContent = {
        model: "replicate-model",
        messages: [{ role: "user", content: "" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
      };

      expect(() => {
        // @ts-ignore - validateParams is protected
        provider.validateParams(paramsWithoutContent as any);
      }).toThrow("Missing last message content");
    });
  });

  describe("FLUX 1.1 Pro model", () => {
    it("should handle text-to-image with output format enum", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "a91bed9b0301d9d10b34b89b1f4d0255f2e2499c59576bfcd13405575dacdb25",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "width", type: "integer", default: 1024 },
            { name: "height", type: "integer", default: 1024 },
            {
              name: "output_format",
              type: "string",
              default: "webp",
              enum: ["webp", "jpg", "png"],
            },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "a91bed9b0301d9d10b34b89b1f4d0255f2e2499c59576bfcd13405575dacdb25",
        messages: [{ role: "user", content: "A beautiful sunset" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        output_format: "png",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        prompt: "A beautiful sunset",
        width: 1024,
        height: 1024,
        output_format: "png",
      });
    });
  });

  describe("SDXL model with attachments", () => {
    it("should handle image input for img2img", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "46ad775d45e4c606eb4a8f022a40e9e3d0a22993815d798bcd2103c0e72427bd",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "image", type: ["file", "string"] },
            { name: "mask", type: ["file", "string"] },
            {
              name: "scheduler",
              type: "string",
              default: "K_EULER",
              enum: ["DDIM", "K_EULER", "PNDM"],
            },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "46ad775d45e4c606eb4a8f022a40e9e3d0a22993815d798bcd2103c0e72427bd",
        messages: [{ role: "user", content: "Make it more colorful" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        image: "https://example.com/image.jpg",
        scheduler: "DDIM",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        prompt: "Make it more colorful",
        image: "https://example.com/image.jpg",
        scheduler: "DDIM",
      });
    });
  });

  describe("Video generation model", () => {
    it("should handle image-to-video with video_length enum", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
        replicateInputSchema: {
          fields: [
            { name: "input_image", type: ["file", "string"], required: true },
            {
              name: "video_length",
              type: "string",
              default: "14_frames_with_svd",
              enum: ["14_frames_with_svd", "25_frames_with_svd_xt"],
            },
            { name: "motion_bucket_id", type: "integer", default: 127 },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
        messages: [{ role: "user", content: "Animate this image" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        input_image: "https://example.com/photo.jpg",
        video_length: "25_frames_with_svd_xt",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        input_image: "https://example.com/photo.jpg",
        video_length: "25_frames_with_svd_xt",
        motion_bucket_id: 127,
      });
    });
  });

  describe("Image upscaling model", () => {
    it("should handle numeric enum for scale parameter", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        replicateInputSchema: {
          fields: [
            { name: "image", type: ["file", "string"], required: true },
            { name: "scale", type: "number", default: 4, enum: [2, 4] },
            { name: "face_enhance", type: "boolean", default: false },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        version:
          "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        messages: [{ role: "user", content: "Upscale this image" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        image: "https://example.com/lowres.jpg",
        scale: 2,
        face_enhance: true,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        image: "https://example.com/lowres.jpg",
        scale: 2,
        face_enhance: true,
      });
    });
  });

  describe("Vision-language model", () => {
    it("should handle multimodal input with image and prompt", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "41ecfbfb261e6c1adf3ad896c9066ca98346996d7c4045c5bc944a79d430f174",
        replicateInputSchema: {
          fields: [
            { name: "image", type: ["file", "string"], required: true },
            { name: "prompt", type: "string", required: true },
            { name: "max_tokens", type: "integer", default: 1024 },
            { name: "temperature", type: "number", default: 0.2 },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "41ecfbfb261e6c1adf3ad896c9066ca98346996d7c4045c5bc944a79d430f174",
        messages: [{ role: "user", content: "What's in this image?" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        image: "https://example.com/scene.jpg",
        temperature: 0.5,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        image: "https://example.com/scene.jpg",
        prompt: "What's in this image?",
        max_tokens: 1024,
        temperature: 0.5,
      });
    });
  });

  describe("Background removal model", () => {
    it("should handle model enum and boolean parameters", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        replicateInputSchema: {
          fields: [
            { name: "image", type: ["file", "string"], required: true },
            {
              name: "model_version",
              type: "string",
              default: "u2net",
              enum: ["u2net", "u2netp", "u2net_human_seg"],
            },
            { name: "alpha_matting", type: "boolean", default: false },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        messages: [{ role: "user", content: "Remove background" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        image: "https://example.com/portrait.jpg",
        alpha_matting: true,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        image: "https://example.com/portrait.jpg",
        model_version: "u2net",
        alpha_matting: true,
      });
    });
  });

  describe("WhisperX transcription model", () => {
    it("should handle audio transcription with diarization", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9",
        replicateInputSchema: {
          fields: [
            { name: "audio_file", type: ["file", "string"], required: true },
            { name: "diarize", type: "boolean", default: false },
            { name: "min_speakers", type: "integer" },
            { name: "max_speakers", type: "integer" },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9",
        messages: [{ role: "user", content: "Transcribe this" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        audio_file: "https://example.com/audio.mp3",
        diarize: true,
        min_speakers: 2,
        max_speakers: 4,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        audio_file: "https://example.com/audio.mp3",
        diarize: true,
        min_speakers: 2,
        max_speakers: 4,
      });
    });
  });

  describe("Audio generation model", () => {
    it("should handle text-to-audio with duration and steps", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "f2d7f3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "duration", type: "number", default: 30 },
            { name: "steps", type: "integer", default: 100 },
            { name: "cfg_scale", type: "number", default: 7 },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "f2d7f3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3",
        messages: [{ role: "user", content: "Upbeat electronic music" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        duration: 60,
        steps: 150,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        prompt: "Upbeat electronic music",
        duration: 60,
        steps: 150,
        cfg_scale: 7,
      });
    });
  });

  describe("Segmentation model", () => {
    it("should handle video segmentation with points and labels", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "77a5f9e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3",
        replicateInputSchema: {
          fields: [
            { name: "video", type: ["file", "string"], required: true },
            { name: "points", type: "string" },
            { name: "labels", type: "string" },
            { name: "multimask_output", type: "boolean", default: false },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "77a5f9e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3",
        messages: [{ role: "user", content: "Segment objects" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        video: "https://example.com/video.mp4",
        points: "[[100,200],[300,400]]",
        labels: "[1,1]",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        video: "https://example.com/video.mp4",
        points: "[[100,200],[300,400]]",
        labels: "[1,1]",
        multimask_output: false,
      });
    });
  });

  describe("Fast transcription model", () => {
    it("should handle task enum and timestamp options", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
        replicateInputSchema: {
          fields: [
            { name: "audio", type: ["file", "string"], required: true },
            {
              name: "task",
              type: "string",
              default: "transcribe",
              enum: ["transcribe", "translate"],
            },
            {
              name: "timestamp",
              type: "string",
              default: "chunk",
              enum: ["chunk", "word"],
            },
            { name: "batch_size", type: "integer", default: 24 },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
        messages: [{ role: "user", content: "Transcribe" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        audio: "https://example.com/speech.wav",
        task: "translate",
        timestamp: "word",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        audio: "https://example.com/speech.wav",
        task: "translate",
        timestamp: "word",
        batch_size: 24,
      });
    });
  });

  describe("Seedream 4 unified model", () => {
    it("should handle both text-to-image and image editing", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "e6cff243d7a5e551e1ca2b4bf291413d649c9f1417f9a52c1c0a4fbc36027b83",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "image", type: ["file", "string"] },
            { name: "width", type: "integer", default: 1024 },
            { name: "height", type: "integer", default: 1024 },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "e6cff243d7a5e551e1ca2b4bf291413d649c9f1417f9a52c1c0a4fbc36027b83",
        messages: [{ role: "user", content: "Remove the background" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        image: "https://example.com/photo.jpg",
        width: 2048,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        prompt: "Remove the background",
        image: "https://example.com/photo.jpg",
        width: 2048,
        height: 1024,
      });
    });
  });

  describe("Video generation with duration and resolution enums", () => {
    it("should handle Seedance Pro Fast with resolution enum", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            {
              name: "duration",
              type: "string",
              default: "5s",
              enum: ["5s", "10s"],
            },
            {
              name: "resolution",
              type: "string",
              default: "720p",
              enum: ["480p", "720p", "1080p"],
            },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7",
        messages: [{ role: "user", content: "Create a video" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        duration: "10s",
        resolution: "1080p",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        prompt: "Create a video",
        duration: "10s",
        resolution: "1080p",
      });
    });
  });

  describe("Sora 2 Pro with extended parameters", () => {
    it("should handle 4K resolution and extended aspect ratios", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "spspspspspspspspspspspspspspspspspspspspspspspspspspspspspspspsp",
        replicateInputSchema: {
          fields: [
            { name: "prompt", type: "string", required: true },
            { name: "duration", type: "integer", default: 10 },
            {
              name: "resolution",
              type: "string",
              default: "1080p",
              enum: ["1080p", "4K"],
            },
            {
              name: "aspect_ratio",
              type: "string",
              default: "16:9",
              enum: ["16:9", "9:16", "1:1", "21:9"],
            },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "spspspspspspspspspspspspspspspspspspspspspspspspspspspspspspspsp",
        messages: [{ role: "user", content: "Cinematic video" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        resolution: "4K",
        aspect_ratio: "21:9",
        duration: 30,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        prompt: "Cinematic video",
        duration: 30,
        resolution: "4K",
        aspect_ratio: "21:9",
      });
    });
  });

  describe("Omni Human multimodal inputs", () => {
    it("should handle image, audio, and video inputs", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "ohohohohohohohohohohohohohohohohohohohohohohohohohohohohohohohoh",
        replicateInputSchema: {
          fields: [
            { name: "image", type: ["file", "string"], required: true },
            { name: "audio", type: ["file", "string"] },
            { name: "video", type: ["file", "string"] },
            { name: "duration", type: "integer", default: 5 },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "ohohohohohohohohohohohohohohohohohohohohohohohohohohohohohohohoh",
        messages: [{ role: "user", content: "Animate" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        image: "https://example.com/person.jpg",
        audio: "https://example.com/speech.mp3",
        duration: 10,
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        image: "https://example.com/person.jpg",
        audio: "https://example.com/speech.mp3",
        duration: 10,
      });
    });
  });

  describe("Dolphin OCR with task enum", () => {
    it("should handle different OCR task types", async () => {
      // @ts-ignore
      vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
        matchingModel:
          "dpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdp",
        replicateInputSchema: {
          fields: [
            { name: "image", type: ["file", "string"], required: true },
            {
              name: "task",
              type: "string",
              default: "ocr",
              enum: ["ocr", "table", "formula"],
            },
            { name: "language", type: "string", default: "en" },
          ],
        },
      });

      const provider = new ReplicateProvider();
      const params = {
        model:
          "dpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdpdp",
        messages: [{ role: "user", content: "Extract table" }],
        env: { AI_GATEWAY_TOKEN: "test-token" },
        image: "https://example.com/document.pdf",
        task: "table",
        language: "zh",
      };

      const result = await provider.mapParameters(params as any);

      expect(result.input).toEqual({
        image: "https://example.com/document.pdf",
        task: "table",
        language: "zh",
      });
    });
  });
});
