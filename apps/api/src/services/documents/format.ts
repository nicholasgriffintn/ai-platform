import type { ServiceContext } from "~/lib/context/serviceContext";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { sanitiseInput } from "~/utils/sanitise";

const FORMAT_PROMPT = `Rewrite the document you are given so it is easier to use, without changing what it says.

- Give it a title if it has none, and group related points under headings.
- Turn abbreviated notes into complete sentences where that helps, and cut repetition.
- Keep the author's voice, terminology and meaning. Do not invent facts.
- Pull anything actionable into a To do section, and any dates into a Timeline section, only if there are some.
- Open with a short summary when the document is long enough to need one.
- Return Markdown only, with no commentary about what you changed.`;

function readProviderText(result: unknown): string | null {
  if (typeof result === "string") {
    return result;
  }

  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as { response?: unknown; choices?: unknown };

  if (typeof record.response === "string") {
    return record.response;
  }

  if (Array.isArray(record.choices)) {
    const message = (record.choices[0] as { message?: { content?: unknown } } | undefined)?.message;

    if (typeof message?.content === "string") {
      return message.content;
    }
  }

  return null;
}

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
    const chat = getChatProvider(provider, { env: context.env, user });
    const messages = [
      { role: "system" as const, content: FORMAT_PROMPT },
      { role: "user" as const, content: body },
    ];

    if (prompt) {
      messages.push({ role: "user" as const, content: sanitiseInput(prompt) });
    }

    const formatted = readProviderText(
      await chat.getResponse(
        { model, env: context.env, context, messages, reasoning: { effort: "none" } },
        user.id,
      ),
    );

    if (!formatted?.trim()) {
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
