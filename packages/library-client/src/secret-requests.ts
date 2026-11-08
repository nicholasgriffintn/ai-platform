import {
  secretRequestSubmissionSchema,
  type SecretRequestSubmission,
  type SubmitSecretRequest,
} from "@ngriffin_uk/polychat-schemas";

import { resource } from "./resource.js";

const conversations = resource<unknown>("/conversations");

export async function submitSecretRequest(
  conversationId: string,
  input: SubmitSecretRequest,
): Promise<SecretRequestSubmission> {
  return secretRequestSubmissionSchema.parse(
    await conversations
      .sub<SecretRequestSubmission, SubmitSecretRequest>(conversationId, "secret_requests")
      .create(input),
  );
}
