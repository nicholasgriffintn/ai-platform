import { z } from "zod";

export const registrationOptionsSchema = z.object({
  username: z.string().optional(),
});

export const registrationVerificationSchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
      authenticatorData: z.string().optional(),
      transports: z.array(z.string()).optional(),
      publicKeyAlgorithm: z.number().optional(),
      publicKey: z.string().optional(),
    }),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: z.record(z.any()).optional(),
    type: z.string(),
  }),
});

export const authenticationOptionsSchema = z.object({
  username: z.string().optional(),
});

export const authenticationVerificationSchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: z.record(z.any()).optional(),
    type: z.string(),
  }),
});
