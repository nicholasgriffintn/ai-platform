import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAudioFromChat, uploadImageFromChat } from "../upload";

const mockStorageService = {
  uploadObject: vi.fn().mockResolvedValue("test-key"),
};

vi.mock("../storage", () => ({
  StorageService: vi.fn().mockImplementation(() => mockStorageService),
}));

const createMockReadableStream = (data: Uint8Array[]) => {
  const index = 0;
  return new ReadableStream({
    start(controller) {},
  }) as ReadableStream & {
    getReader: () => {
      read: () => Promise<{ done: boolean; value?: Uint8Array }>;
    };
  };
};

describe("Upload Functions", () => {
  const mockEnv = {
    ASSETS_BUCKET: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadImageFromChat", () => {
    it("should upload image from ReadableStream", async () => {
      const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
      const chunkIndex = 0;

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunks[0]);
          controller.enqueue(chunks[1]);
          controller.close();
        },
      });

      const imageKey = "test-image.png";
      const result = await uploadImageFromChat(
        mockStream,
        mockEnv as any,
        imageKey,
      );

      expect(result).toBe("test-key");
      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        imageKey,
        expect.any(ArrayBuffer),
        {
          contentType: "image/png",
          contentLength: 6,
        },
      );
    });

    it("should upload image from base64 string", async () => {
      const base64String =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      const imageKey = "test-image.png";

      const result = await uploadImageFromChat(
        base64String,
        mockEnv as any,
        imageKey,
      );

      expect(result).toBe("test-key");
      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        imageKey,
        expect.any(ArrayBuffer),
        {
          contentType: "image/png",
          contentLength: expect.any(Number),
        },
      );
    });

    it("should handle multiple chunks from ReadableStream", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.enqueue(new Uint8Array([3, 4]));
          controller.enqueue(new Uint8Array([5, 6]));
          controller.close();
        },
      });

      const imageKey = "test-multi-chunk.png";
      const result = await uploadImageFromChat(
        mockStream,
        mockEnv as any,
        imageKey,
      );

      expect(result).toBe("test-key");
      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        imageKey,
        expect.any(ArrayBuffer),
        {
          contentType: "image/png",
          contentLength: 6,
        },
      );
    });

    it("should handle different image MIME types", async () => {
      const jpegBase64 =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/gA==";
      const imageKey = "test-jpeg.jpg";

      const result = await uploadImageFromChat(
        jpegBase64,
        mockEnv as any,
        imageKey,
      );

      expect(result).toBe("test-key");
    });

    it("should handle malformed base64 data", async () => {
      const malformedBase64 = "data:image/png;base64,invalid-base64";
      const imageKey = "test-malformed.png";

      await expect(
        uploadImageFromChat(malformedBase64, mockEnv as any, imageKey),
      ).rejects.toThrow();
    });
  });

  describe("uploadAudioFromChat", () => {
    it("should upload audio from ReadableStream", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.close();
        },
      });

      const audioKey = "test-audio.mp3";
      const result = await uploadAudioFromChat(
        mockStream,
        mockEnv as any,
        audioKey,
      );

      expect(result).toBe("test-key");
      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        audioKey,
        expect.any(ArrayBuffer),
        {
          contentType: "audio/mp3",
          contentLength: 4,
        },
      );
    });

    it("should upload audio from base64 string", async () => {
      const base64String = "data:audio/mp3;base64,SUQzAwAAAAABAAAA";
      const audioKey = "test-audio.mp3";

      const result = await uploadAudioFromChat(
        base64String,
        mockEnv as any,
        audioKey,
      );

      expect(result).toBe("test-key");
      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        audioKey,
        expect.any(ArrayBuffer),
        {
          contentType: "audio/mp3",
          contentLength: expect.any(Number),
        },
      );
    });

    it("should handle different audio MIME types", async () => {
      const wavBase64 =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAA=";
      const audioKey = "test-wav.wav";

      const result = await uploadAudioFromChat(
        wavBase64,
        mockEnv as any,
        audioKey,
      );

      expect(result).toBe("test-key");
    });

    it("should handle empty ReadableStream", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const audioKey = "test-empty.mp3";
      const result = await uploadAudioFromChat(
        mockStream,
        mockEnv as any,
        audioKey,
      );

      expect(result).toBe("test-key");
      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        audioKey,
        expect.any(ArrayBuffer),
        {
          contentType: "audio/mp3",
          contentLength: 0,
        },
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty base64 data", async () => {
      const emptyBase64 = "data:image/png;base64,";
      const imageKey = "test-empty.png";

      const result = await uploadImageFromChat(
        emptyBase64,
        mockEnv as any,
        imageKey,
      );

      expect(result).toBe("test-key");
    });

    it("should handle base64 without MIME type prefix", async () => {
      const base64WithoutMime =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      const imageKey = "test-no-mime.png";

      const result = await uploadImageFromChat(
        base64WithoutMime,
        mockEnv as any,
        imageKey,
      );

      expect(result).toBe("test-key");
    });

    it("should handle ReadableStream read errors", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.error(new Error("Read error"));
        },
      });

      const imageKey = "test-read-error.png";

      await expect(
        uploadImageFromChat(mockStream, mockEnv as any, imageKey),
      ).rejects.toThrow("Read error");
    });
  });
});
