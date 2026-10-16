import { estimateTextTokens } from "@ngriffin_uk/polychat-ai-providers";

import type { Attachment } from "~/types";

export const ATTACHMENT_CONTEXT_SHARE = 0.75;

export function attachmentTokenBudget(contextWindow: number, userText: string): number {
  return Math.floor(contextWindow * ATTACHMENT_CONTEXT_SHARE) - estimateTextTokens(userText);
}

function attachmentTokens(attachment: Attachment): number {
  return estimateTextTokens(attachment.markdown ?? "");
}

export async function fitMarkdownAttachments(
  attachments: readonly Attachment[],
  budgetTokens: number,
  digest: (attachment: Attachment) => Promise<string>,
): Promise<Attachment[]> {
  const fitted = [...attachments];
  let total = fitted.reduce((sum, attachment) => sum + attachmentTokens(attachment), 0);
  const largestFirst = fitted
    .map((attachment, index) => ({ index, tokens: attachmentTokens(attachment) }))
    .sort((left, right) => right.tokens - left.tokens);

  for (const { index, tokens } of largestFirst) {
    if (total <= budgetTokens) {
      break;
    }

    const markdown = await digest(fitted[index]);

    fitted[index] = { ...fitted[index], markdown };
    total += estimateTextTokens(markdown) - tokens;
  }

  return fitted;
}
