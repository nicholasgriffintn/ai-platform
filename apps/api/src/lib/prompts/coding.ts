import type { IBody, IUserSettings } from "~/types";
import { PromptBuilder } from "./builder";
import { getArtifactExample, getResponseStyle } from "./utils";

export function returnCodingPrompt(
  request: IBody,
  userSettings?: IUserSettings,
  supportsFunctions?: boolean,
  supportsArtifacts?: boolean,
  hasThinking?: boolean,
): string {
  const chatMode = request.mode || "standard";

  const userNickname = userSettings?.nickname || null;
  const userJobRole = userSettings?.job_role || null;
  const userTraits = userSettings?.traits || null;
  const userPreferences = userSettings?.preferences || null;
  const memoriesEnabled =
    userSettings?.memories_save_enabled ||
    userSettings?.memories_chat_history_enabled;

  const response_mode = request.response_mode || "normal";

  const isAgent = chatMode === "agent";

  const {
    traits,
    preferences,
    problemBreakdownInstructions,
    answerFormatInstructions,
  } = getResponseStyle(
    response_mode,
    hasThinking,
    supportsFunctions,
    supportsArtifacts,
    isAgent,
    memoriesEnabled,
    userTraits,
    userPreferences,
    true,
  );

  const builder = new PromptBuilder(
    "<assistant_info>You are an experienced software developer tasked with answering coding questions or generating code based on user requests. Your responses should be professional, accurate, and tailored to the specified programming language when applicable.</assistant_info>",
  )
    .addLine()
    .addLine(`<response_traits>${traits}</response_traits>`)
    .addLine(`<response_preferences>${preferences}</response_preferences>`)
    .addLine()
    .addLine("<user_context>")
    .addIf(!!userNickname, `<user_nickname>${userNickname}</user_nickname>`)
    .addIf(!!userJobRole, `<user_job_role>${userJobRole}</user_job_role>`)
    .addLine("</user_context>")
    .startSection();

  builder
    .addLine("Here is an example of the output you should provide:")
    .addLine("<example_output>")
    .addLine("<answer>")
    .addLine(
      "<introduction>Brief introduction addressing the user's question or request</introduction>",
    )
    .addLine();

  if (!hasThinking) {
    builder
      .addLine("<analysis>")
      .addLine(problemBreakdownInstructions)
      .addLine("</analysis>")
      .addLine();
  }

  if (supportsArtifacts) {
    builder
      .addLine()
      .addLine(getArtifactExample(supportsArtifacts, true))
      .addLine();
  } else {
    builder.addLine(`<solution>${answerFormatInstructions}</solution>`);
  }

  builder
    .addLine()
    .addLine(
      "<implementation_explanation>Explanation of key parts of the implementation, if code was provided</implementation_explanation>",
    )
    .addLine()
    .addLine(
      "<additional_info>Additional considerations, best practices, or alternative approaches if relevant</additional_info>",
    )
    .addLine("</answer>")
    .addLine("</example_output>")
    .startSection()
    .addLine(
      "Remember to tailor your response to the specified programming language when applicable, and always strive for accuracy and professionalism in your explanations and code examples.",
    );

  return builder.build();
}
