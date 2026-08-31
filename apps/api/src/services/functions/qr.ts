import {
  assertQrPayloadLength,
  buildQrImageUrl,
  MAX_QR_PAYLOAD_LENGTH,
  normaliseQrSize,
} from "~/utils/qr";

import type { ApiToolDefinition } from "../../types/functions";
import { create_qr_code as create_qr_codeDescriptor } from "./definitions/qr";

export const create_qr_code: ApiToolDefinition = {
  ...create_qr_codeDescriptor,
  execute: async (args) => {
    const payload = typeof args.payload === "string" ? args.payload.trim() : "";

    if (!payload) {
      return {
        status: "error",
        name: "create_qr_code",
        content: "Provide the exact text, URL, phone number, email, or Wi-Fi payload to encode.",
        data: {},
      };
    }

    try {
      assertQrPayloadLength(payload);
    } catch {
      return {
        status: "error",
        name: "create_qr_code",
        content: `QR payloads are limited to ${MAX_QR_PAYLOAD_LENGTH} characters.`,
        data: { maxLength: MAX_QR_PAYLOAD_LENGTH },
      };
    }

    const size = normaliseQrSize(args.size);
    const imageUrl = buildQrImageUrl(payload, size.label);

    return {
      status: "success",
      name: "create_qr_code",
      content:
        "QR code image created. Return this imageUrl to the user and include the encoded payload for review.",
      data: {
        imageUrl,
        mimeType: "image/png",
        payload,
        size: size.label,
      },
    };
  },
};
