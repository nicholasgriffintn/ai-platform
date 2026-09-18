import { buildDocumentFormatPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { ai } from "~/lib/ai";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/services/models/resolve";
import type { IUser } from "~/types";

export async function formatDocumentBody({
  context,
  user,
  body,
  prompt,
}: {
  context: ServiceContext;
  user: IUser;
  body: string;
  prompt?: string;
}): Promise<string> {
  try {
    const { model, provider } = await getAuxiliaryModel(context.env, user);
    const messages = [{ role: "user" as const, content: body }];

    if (prompt) {
      messages.push({ role: "user" as const, content: sanitiseInput(prompt) });
    }

    const formatted = await ai.generateText({
      env: context.env,
      user,
      model,
      provider,
      system: buildDocumentFormatPrompt(),
      messages,
      reasoning: { effort: "none" },
    });

    if (!formatted.trim()) {
      throw new AssistantError("The rewrite came back empty", ErrorType.PROVIDER_ERROR);
    }

    return formatted.trim();
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }

    throw new AssistantError("Could not rewrite the document", ErrorType.EXTERNAL_API_ERROR);
  }
}
