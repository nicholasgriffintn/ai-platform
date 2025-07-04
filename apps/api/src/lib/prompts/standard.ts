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
  requiresThinkingPrompt?: boolean,
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

    const {
      traits,
      preferences,
      problemBreakdownInstructions,
      answerFormatInstructions,
    } = getResponseStyle(
      response_mode,
      hasThinking,
      requiresThinkingPrompt,
      supportsFunctions,
      supportsArtifacts,
      isAgent,
      memoriesEnabled,
      userTraits,
      userPreferences,
      false,
    );

    const builder = new PromptBuilder(
      isAgent
        ? "<assistant_info>You are a helpful agent with access to a range of powerful tools that extend your capabilities.</assistant_info>"
        : "<assistant_info>You are an AI assistant helping with daily tasks.</assistant_info>",
    )
      .addLine()
      .addLine(`<response_traits>${traits}</response_traits>`)
      .addLine(`<response_preferences>${preferences}</response_preferences>`)
      .addLine()
      .addLine("<user_context>")
      .addIf(!!userNickname, `<user_nickname>${userNickname}</user_nickname>`)
      .addIf(!!userJobRole, `<user_job_role>${userJobRole}</user_job_role>`)
      .addIf(!!date, `<current_date>${date}</current_date>`)
      .addIf(
        !!latitude && !!longitude,
        `<user_location><latitude>${latitude}</latitude><longitude>${longitude}</longitude></user_location>`,
      )
      .addLine("</user_context>");

    if (!isAgent) {
      builder.addLine("Here is an example of the output you should provide:");
      builder.addLine("<example_output>");

      if (!hasThinking) {
        builder
          .addLine("<think>")
          .addLine(problemBreakdownInstructions)
          .addLine("</think>");
      }

      builder.addLine("<answer>");

      builder.addLine(answerFormatInstructions);

      if (supportsArtifacts) {
        builder.addLine(getArtifactExample(supportsArtifacts, false));
      }

      builder.addLine("</answer>");
      builder.addLine("</example_output>");
    }

    if (isAgent) {
      builder.addLine("<tool_usage_guidelines>");
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

      builder.addLine("<multi_step_reasoning_workflow>");
      builder.addLine("Follow this precise workflow when using tools:");
      builder.addLine(
        "1. Use appropriate tools to gather information needed for the user's request",
      );
      builder.addLine(
        "2. After EACH non-reasoning tool call, use the `add_reasoning_step` tool to:",
      );
      builder.addLine("   - Analyze the tool's output");
      builder.addLine("   - Determine your next step");
      builder.addLine(
        '   - If you need more information: set `nextStep` to "continue" and use another tool',
      );
      builder.addLine(
        '   - If you have all needed information: set `nextStep` to "finalAnswer"',
      );

      builder.addLine("3. **⚠️ CRITICAL - FINAL ANSWER PROCESS ⚠️:**");
      builder.addLine(
        '   - When ANY reasoning step contains `nextStep="finalAnswer"`, you MUST immediately STOP using ALL tools',
      );
      builder.addLine(
        "   - Your VERY NEXT MESSAGE after seeing finalAnswer must be your complete response to the user",
      );
      builder.addLine(
        "   - This is a DIRECT response to the user, NOT another tool call",
      );
      builder.addLine(
        "   - NEVER use any tools after a finalAnswer signal, regardless of what previous conversations show",
      );
      builder.addLine(
        "   - Even if the tool history contains many previous tool calls, a finalAnswer overrides all further tool usage",
      );

      builder.addLine("<example_workflow_sequence>");
      builder.addLine("```");
      builder.addLine("1. [Tool Call]: weather_lookup");
      builder.addLine(
        "2. [Tool Call]: add_reasoning_step (nextStep: continue)",
      );
      builder.addLine("3. [Tool Call]: calculator");
      builder.addLine(
        "4. [Tool Call]: add_reasoning_step (nextStep: finalAnswer) ← STOP HERE",
      );
      builder.addLine(
        "5. [DIRECT RESPONSE TO USER]: Your final answer with no more tool calls",
      );
      builder.addLine("```");

      builder.addLine("<tool_availability>");
      builder.addLine(
        "If a user requests functionality requiring tools that aren't currently available, politely inform them that:",
      );
      builder.addLine(
        "- They can add tools via the settings icon in the bottom right corner of the chat input",
      );
      builder.addLine(
        "- You'll work with whatever tools are currently available to provide the best possible assistance",
      );
      builder.addLine("</tool_usage_guidelines>");
    }

    return builder.build();
  } catch (error) {
    logger.error("Error generating standard prompt", { error });
    return "";
  }
}
