import type { IBody, IUser, IUserSettings } from "~/types";
import { getLogger } from "~/utils/logger";
import { PromptBuilder } from "./builder";
import { getArtifactExample, getResponseStyle } from "./utils";

const logger = getLogger({ prefix: "STANDARD_PROMPT" });

export async function returnStandardPrompt(
  request: IBody,
  user?: IUser,
  userSettings?: IUserSettings,
  supportsFunctions?: boolean,
  supportsArtifacts?: boolean,
  hasThinking?: boolean,
): Promise<string> {
  try {
    const chatMode = request.mode || "standard";

    const userNickname = userSettings?.nickname || null;
    const userJobRole = userSettings?.job_role || null;
    const userTraits = userSettings?.traits || null;
    const userPreferences = userSettings?.preferences || null;
    const memoriesEnabled =
      userSettings?.memories_save_enabled ||
      userSettings?.memories_chat_history_enabled;

    const latitude = request.location?.latitude || user?.latitude;
    const longitude = request.location?.longitude || user?.longitude;
    const date = request.date || new Date().toISOString().split("T")[0];
    const response_mode = request.response_mode || "normal";

    const isAgent = chatMode === "agent";

    const { traits, preferences } = getResponseStyle(
      response_mode,
      hasThinking,
      supportsFunctions,
      supportsArtifacts,
      isAgent,
    );

    const DEFAULT_TRAITS = traits;
    const DEFAULT_PREFERENCES = preferences;

    const builder = new PromptBuilder(
      isAgent
        ? "You are a helpful assistant with access to powerful tools that extend your capabilities."
        : "You are an AI assistant helping with daily tasks.",
    )
      .addLine(
        `Embody these traits in your responses: ${userTraits || DEFAULT_TRAITS}`,
      )
      .addLine(
        `Follow these guidelines when responding:\n${userPreferences || DEFAULT_PREFERENCES}`,
      )
      .addIf(
        memoriesEnabled,
        "You have the ability to store long-term conversational memories when the user asks you to remember important facts or events, and will recall them when relevant.",
      )
      .addIf(
        !memoriesEnabled,
        "The memories feature has been disabled for this user. If the user asks you to remember something, politely ask them to go to Settings > Customisation > Memories to enable it.",
      )
      .startSection("Context")
      .addIf(!!userNickname, `<user_nickname>${userNickname}</user_nickname>`)
      .addIf(!!userJobRole, `<user_job_role>${userJobRole}</user_job_role>`)
      .addIf(!!date, `<current_date>${date}</current_date>`)
      .addIf(
        !!latitude && !!longitude,
        `<user_location><latitude>${latitude}</latitude><longitude>${longitude}</longitude></user_location>`,
      );

    if (!isAgent) {
      builder.startSection("Example output");

      if (!hasThinking) {
        builder
          .addLine("Example analysis:")
          .addLine("<analysis>")
          .addLine(
            "Your detailed analysis of the question, considering context and required information",
          )
          .addLine("</analysis>");
      }

      builder.addLine("<answer>");

      let answerStyle = "";
      if (response_mode === "concise") {
        answerStyle = "concise, 1-2 sentence";
      } else if (response_mode === "explanatory") {
        answerStyle = "detailed and thorough";
      } else if (response_mode === "formal") {
        answerStyle = "formal and professional";
      } else {
        answerStyle = "balanced";
      }

      builder.addLine(`Your ${answerStyle} response to the user's question`);

      if (supportsArtifacts) {
        builder
          .addLine("When appropriate for substantial content:")
          .addLine(getArtifactExample(supportsArtifacts, false));
      }

      builder.addLine("</answer>");
    }

    if (isAgent) {
      builder.startSection("Tool Usage Guidelines");
      builder.addLine("When working with tools, follow these principles:");
      builder.addLine(
        "1. **Analyze First**: Understand what information or actions are needed to address the user's request",
      );
      builder.addLine(
        "2. **Select Appropriately**: Choose tools based on their capabilities and the specific requirements of the task",
      );
      builder.addLine(
        "3. **Combine When Necessary**: Some requests may require sequential or parallel use of multiple tools",
      );
      builder.addLine(
        "4. **Handle Results Thoughtfully**: Process tool outputs to create coherent, useful responses",
      );
      builder.addLine(
        "5. **Multi-Step Reasoning**: After you use a tool that is not the reasoning tool, use the `add_reasoning_step` tool to expand on the response and provide a more detailed answer.",
      );

      builder.startSection("Multi-Step Reasoning");
      builder.addLine(
        "1. **Use the `add_reasoning_step` tool immediately after each non-reasoning tool call**",
      );
      builder.addLine("2. In the reasoning step:");
      builder.addLine("   - Document your interpretation of tool results");
      builder.addLine("   - Explain your reasoning about next steps");
      builder.addLine(
        '   - Set `nextStep` to "continue" if more tool calls are needed',
      );
      builder.addLine(
        '   - Set `nextStep` to "finalAnswer" when you have all the information needed to respond directly to the user',
      );
      builder.addLine('3. When a reasoning step has `nextStep="finalAnswer"`:');
      builder.addLine(
        "   - This reasoning step itself IS your final tool interaction",
      );
      builder.addLine(
        "   - Immediately follow it with your comprehensive response directly to the user",
      );
      builder.addLine(
        "   - **Do not use any more tools, including the reasoning tool, after this point**",
      );

      builder.startSection("Tool Availability");
      builder.addLine(
        "If a user requests functionality requiring tools that aren't currently available, politely inform them that:",
      );
      builder.addLine(
        "- They can add tools via the settings icon in the bottom right corner of the chat input",
      );
      builder.addLine(
        "- You'll work with whatever tools are currently available to provide the best possible assistance",
      );
    }

    return builder.build();
  } catch (error) {
    logger.error("Error generating standard prompt", { error });
    return "";
  }
}
