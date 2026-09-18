import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { ai } from "~/lib/ai";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/services/models/resolve";
import type { IUser } from "~/types";

const FORMAT_PROMPT = `Rewrite the document you are given so it is easier to use, without changing what it says.

- Give it a title if it has none, and group related points under headings.
- Turn abbreviated notes into complete sentences where that helps, and cut repetition.
- Keep the author's voice, terminology and meaning. Do not invent facts.
- Pull anything actionable into a To do section, and any dates into a Timeline section, only if there are some.
- Open with a short summary when the document is long enough to need one.
- Return Markdown only, with no commentary about what you changed.`;

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
      system: FORMAT_PROMPT,
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
