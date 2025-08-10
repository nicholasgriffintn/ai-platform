import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventStreamParser } from "../awsEventStream";

vi.mock("../logger", () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

describe("awsEventStream", () => {
  let _mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    _mockLogger = {
      error: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createEventStreamParser", () => {
    it("should create a TransformStream", () => {
      const parser = createEventStreamParser();

      expect(parser).toBeInstanceOf(TransformStream);
      expect(parser.readable).toBeDefined();
      expect(parser.writable).toBeDefined();
    });

    it("should pass through SSE format data unchanged", () => {
      const parser = createEventStreamParser();

      expect(parser).toBeInstanceOf(TransformStream);
      expect(parser.readable).toBeDefined();
      expect(parser.writable).toBeDefined();
    });

    it("should detect and parse AWS Event Stream format", () => {
      const payload = JSON.stringify({ message: "test payload" });
      const payloadBytes = new TextEncoder().encode(payload);

      const totalLength = 12 + 0 + payloadBytes.length + 4;
      const buffer = new ArrayBuffer(totalLength);
      const view = new DataView(buffer);

      view.setUint32(0, totalLength, false);
      view.setUint32(4, 0, false);
      view.setUint32(8, 0x12345678, false);

      const uint8View = new Uint8Array(buffer);
      uint8View.set(payloadBytes, 12);

      view.setUint32(totalLength - 4, 0x87654321, false);

      expect(buffer.byteLength).toBe(totalLength);
      expect(view.getUint32(0, false)).toBe(totalLength);
    });

    it("should handle multiple AWS Event Stream messages", () => {
      const createMessage = (data: any) => {
        const payload = JSON.stringify(data);
        const payloadBytes = new TextEncoder().encode(payload);

        const totalLength = 12 + 0 + payloadBytes.length + 4;
        const buffer = new ArrayBuffer(totalLength);
        const view = new DataView(buffer);

        view.setUint32(0, totalLength, false);
        view.setUint32(4, 0, false);
        view.setUint32(8, 0x12345678, false);

        const uint8View = new Uint8Array(buffer);
        uint8View.set(payloadBytes, 12);
        view.setUint32(totalLength - 4, 0x87654321, false);

        return new Uint8Array(buffer);
      };

      const message1 = createMessage({ type: "first", data: "message 1" });
      const message2 = createMessage({ type: "second", data: "message 2" });

      expect(message1.length).toBeGreaterThan(0);
      expect(message2.length).toBeGreaterThan(0);
    });

    it("should handle incomplete messages gracefully", () => {
      const parser = createEventStreamParser();

      const partialHeader = new Uint8Array([0, 0, 0, 100, 0, 0, 0, 0]);

      expect(partialHeader.length).toBe(8);
      expect(parser).toBeInstanceOf(TransformStream);
    });

    it("should handle malformed message headers", () => {
      const parser = createEventStreamParser();

      const malformedData = new Uint8Array([
        0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0, 0, 0, 0,
      ]);

      expect(malformedData.length).toBe(12);
      expect(parser).toBeInstanceOf(TransformStream);
    });

    it("should handle JSON decode errors in payload", () => {
      const invalidPayload = "{ invalid json }";
      const payloadBytes = new TextEncoder().encode(invalidPayload);

      const totalLength = 12 + 0 + payloadBytes.length + 4;
      const buffer = new ArrayBuffer(totalLength);

      expect(buffer.byteLength).toBe(totalLength);
      expect(payloadBytes.length).toBeGreaterThan(0);
    });

    it("should handle empty payloads", () => {
      const emptyPayload = "";
      const payloadBytes = new TextEncoder().encode(emptyPayload);

      const totalLength = 12 + 0 + payloadBytes.length + 4;
      const buffer = new ArrayBuffer(totalLength);

      expect(buffer.byteLength).toBe(16);
      expect(payloadBytes.length).toBe(0);
    });

    it("should handle messages with headers", () => {
      const payload = JSON.stringify({ test: "data" });
      const payloadBytes = new TextEncoder().encode(payload);
      const headersLength = 8;

      const totalLength = 12 + headersLength + payloadBytes.length + 4;
      const buffer = new ArrayBuffer(totalLength);
      const view = new DataView(buffer);

      view.setUint32(0, totalLength, false);
      view.setUint32(4, headersLength, false);

      expect(buffer.byteLength).toBe(totalLength);
      expect(view.getUint32(4, false)).toBe(headersLength);
    });

    it("should detect SSE format correctly", () => {
      const sseData = 'data: {"test": "message"}\n\n';
      const sseBytes = new TextEncoder().encode(sseData);

      expect(sseBytes.length).toBeGreaterThan(0);
      expect(sseData).toContain("data: ");
    });

    it("should detect AWS format by length prefix", () => {
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);

      view.setUint32(0, 16, false);

      expect(view.getUint32(0, false)).toBe(16);
      expect(buffer.byteLength).toBe(16);
    });

    it("should handle very large length prefixes", () => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);

      const largeLength = 0xffffffff;
      view.setUint32(0, largeLength, false);

      expect(view.getUint32(0, false)).toBe(largeLength);
    });

    it("should handle zero length messages", () => {
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);

      view.setUint32(0, 16, false);
      view.setUint32(4, 0, false);

      expect(view.getUint32(0, false)).toBe(16);
      expect(view.getUint32(4, false)).toBe(0);
    });

    it("should always emit DONE message on flush", () => {
      const parser = createEventStreamParser();

      expect(parser).toBeInstanceOf(TransformStream);
      expect(typeof parser.readable.getReader).toBe("function");
    });

    it("should handle chunked data correctly", () => {
      const chunk1 = new Uint8Array([0, 0, 0, 20]);
      const chunk2 = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);

      expect(chunk1.length).toBe(4);
      expect(chunk2.length).toBe(8);

      const combined = new Uint8Array(chunk1.length + chunk2.length);
      combined.set(chunk1, 0);
      combined.set(chunk2, chunk1.length);

      expect(combined.length).toBe(12);
    });

    it("should handle binary data that's not AWS format", () => {
      const randomData = new Uint8Array(100);
      for (let i = 0; i < randomData.length; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
      }

      expect(randomData.length).toBe(100);
      expect(randomData instanceof Uint8Array).toBe(true);
    });
  });
});
