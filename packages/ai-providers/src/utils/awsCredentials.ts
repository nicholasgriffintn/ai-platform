import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { parseDelimitedCredentials } from "./helpers.js";

const awsCredentialsSchema = z
  .object({
    accessKey: z.string().trim().min(1),
    secretKey: z.string().trim().min(1),
    sessionToken: z.string().trim().min(1).optional(),
  })
  .strict();

export type AwsCredentials = z.infer<typeof awsCredentialsSchema>;

export function validateAwsCredentials(input: unknown): AwsCredentials {
  const parsed = awsCredentialsSchema.safeParse(input);

  if (!parsed.success) {
    throw new AssistantError("Invalid AWS credentials format", ErrorType.CONFIGURATION_ERROR);
  }

  return parsed.data;
}

export function parseAwsSessionCredentials(value: string): AwsCredentials {
  const [accessKey, secretKey, sessionToken] = parseDelimitedCredentials(
    value,
    "::@@::",
    [2, 3],
    "Invalid AWS credentials format",
  );

  return validateAwsCredentials({ accessKey, secretKey, sessionToken });
}
