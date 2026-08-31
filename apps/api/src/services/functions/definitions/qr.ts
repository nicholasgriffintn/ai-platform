import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const create_qr_code: FunctionToolDescriptor = {
  name: "create_qr_code",
  description:
    "Creates a QR code image URL for exact user-supplied text, URLs, phone numbers, email addresses, or Wi-Fi payloads. Do not alter the payload before encoding.",
  type: "normal",
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      payload: {
        type: "string",
        description: "The exact text to encode into the QR code.",
      },
      size: {
        type: "string",
        description: "Optional QR image size such as 520x520. Defaults to 520x520.",
      },
    },
    required: ["payload"],
  }),
};
