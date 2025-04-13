import { z } from "zod";

const base64urlRegex = /^[A-Za-z0-9_-]*$/;
const isBase64url = (v: string) => base64urlRegex.test(v);

export const registrationOptionsSchema = z.object({});

export const registrationVerificationSchema = z.object({
  response: z.object({
    id: z.string().min(1).refine(isBase64url, {
      message: "ID must be base64url encoded",
    }),
    rawId: z.string().min(1).refine(isBase64url, {
      message: "Raw ID must be base64url encoded",
    }),
    response: z.object({
      clientDataJSON: z.string().min(1),
      attestationObject: z.string().min(1),
      authenticatorData: z.string().optional(),
      transports: z
        .array(
          z.enum([
            "ble",
            "cable",
            "hybrid",
            "internal",
            "nfc",
            "smart-card",
            "usb",
          ]),
        )
        .optional(),
      publicKeyAlgorithm: z.number().optional(),
      publicKey: z.string().optional(),
    }),
    authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
    clientExtensionResults: z.record(z.any()).optional(),
    type: z.literal("public-key"),
  }),
});

export const authenticationOptionsSchema = z.object({
  username: z.string().email().optional(),
});

export const authenticationVerificationSchema = z.object({
  response: z.object({
    id: z.string().min(1).refine(isBase64url, {
      message: "ID must be base64url encoded",
    }),
    rawId: z.string().min(1).refine(isBase64url, {
      message: "Raw ID must be base64url encoded",
    }),
    response: z.object({
      authenticatorData: z.string().min(1),
      clientDataJSON: z.string().min(1),
      signature: z.string().min(1),
      userHandle: z.string().optional(),
    }),
    authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
    clientExtensionResults: z.record(z.any()).optional(),
    type: z.literal("public-key"),
  }),
});
