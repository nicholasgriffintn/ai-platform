import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { runWithSystemModel } from "~/modules/models/application/resolve";

export interface PictureQuestion {
  prompt: string;
  image: ArrayBuffer;
  mimeType: string;
}

export async function describePicture(
  context: ServiceContext,
  question: PictureQuestion,
): Promise<string> {
  const user = context.requireUser();
  const answer = await runWithSystemModel(
    context.env,
    user,
    "vision",
    ({ model, provider, effort }) =>
      ai.generateText({
        env: context.env,
        user,
        model,
        provider,
        reasoning_effort: effort,
        disable_functions: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: question.prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${question.mimeType};base64,${bufferToBase64(question.image)}`,
                },
              },
            ],
          },
        ],
      }),
    {},
    { inputs: ["image"] },
  );

  return answer.trim();
}
