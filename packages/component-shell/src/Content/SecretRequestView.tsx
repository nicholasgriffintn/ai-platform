import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import { SecretRequestForm } from "@ngriffin_uk/polychat-component-conversation";
import { useConversationScope } from "@ngriffin_uk/polychat-library-react";
import {
  secretRequestViewDataSchema,
  type SecretRequestViewData,
} from "@ngriffin_uk/polychat-schemas";

import { useSecretRequestSubmission } from "./useSecretRequestSubmission.js";

export function SecretRequestView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const parsed = secretRequestViewDataSchema.safeParse(data);

  return parsed.success ? (
    <PendingSecretRequest
      key={parsed.data.interactionId}
      request={parsed.data}
      onToolInteraction={onToolInteraction}
    />
  ) : null;
}

function PendingSecretRequest({
  request,
  onToolInteraction,
}: {
  request: SecretRequestViewData;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const { currentConversationId } = useConversationScope();
  const submission = useSecretRequestSubmission({
    request,
    conversationId: currentConversationId,
    onToolInteraction,
  });
  const pending = request.humanInTheLoop?.status === "pending" && !submission.settled;

  return (
    <section className="space-y-2 rounded-lg border border-attention/45 p-3 text-sm">
      {pending && submission.available ? (
        <SecretRequestForm
          request={request}
          disabled={submission.isSubmitting}
          onSubmit={submission.submit}
          onDecline={submission.decline}
        />
      ) : (
        <p className="text-muted-foreground">
          {pending
            ? `${request.label} can be provided from the conversation it was requested in.`
            : `${request.label} was requested privately.`}
        </p>
      )}
      {submission.error && (
        <p role="alert" className="text-destructive">
          {submission.error}
        </p>
      )}
    </section>
  );
}
