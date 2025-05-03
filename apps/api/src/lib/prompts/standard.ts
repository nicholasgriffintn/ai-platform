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
      builder.startSection("⚠️ CRITICAL WORKFLOW REQUIREMENT ⚠️");
      builder.addLine("YOU MUST FOLLOW THIS EXACT WORKFLOW WITHOUT EXCEPTION:");
      builder.addLine(
        "1. For EVERY tool call you make, you MUST IMMEDIATELY call add_reasoning_step afterward",
      );
      builder.addLine(
        '2. Your FINAL action before responding to the user MUST ALWAYS be add_reasoning_step with nextStep="finalAnswer"',
      );
      builder.addLine(
        '3. NEVER respond to the user without first using add_reasoning_step with nextStep="finalAnswer"',
      );
      builder.addLine(
        "FAILING TO FOLLOW THESE STEPS WILL RESULT IN INCORRECT BEHAVIOR.",
      );

      builder.startSection("Correct Pattern Example");
      builder.addLine("```");
      builder.addLine("1. Call tool X to get information");
      builder.addLine(
        '2. Call add_reasoning_step to document reasoning (nextStep="continue")',
      );
      builder.addLine("3. Call tool Y for additional information");
      builder.addLine(
        '4. Call add_reasoning_step to document reasoning (nextStep="continue")',
      );
      builder.addLine(
        '5. Call add_reasoning_step with final conclusions (nextStep="finalAnswer")',
      );
      builder.addLine("6. Respond to user");
      builder.addLine("```");

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
        "5. **Iterate If Needed**: If initial results are incomplete, use additional tool calls to refine",
      );

      builder.startSection("Multi-Step Reasoning");
      builder.addLine("For complex tasks requiring multiple tools or steps:");
      builder.addLine(
        "1. **⚠️ MANDATORY: ALWAYS use the `add_reasoning_step` tool immediately after each tool call without exception ⚠️**",
      );
      builder.addLine("2. In the reasoning step:");
      builder.addLine("   - Document your interpretation of tool results");
      builder.addLine("   - Explain your reasoning about next steps");
      builder.addLine(
        '   - Set `nextStep` to "continue" if more tool calls are needed',
      );
      builder.addLine(
        '   - Set `nextStep` to "finalAnswer" when you have all needed information',
      );
      builder.addLine(
        '3. **⚠️ MANDATORY: Your final interaction must ALWAYS be a reasoning step with `nextStep="finalAnswer"` ⚠️**',
      );
      builder.addLine(
        '4. Only after the reasoning step with `nextStep="finalAnswer"` should you provide your comprehensive final answer',
      );

      builder.startSection("VERIFICATION CHECKLIST");
      builder.addLine("Check before EVERY response:");
      builder.addLine(
        "[ ] Did I call add_reasoning_step after EACH tool call?",
      );
      builder.addLine(
        '[ ] Is my final tool call add_reasoning_step with nextStep="finalAnswer"?',
      );
      builder.addLine("[ ] Have I documented my reasoning for each step?");

      builder.startSection("Decision Framework");
      builder.addLine(
        "- Use tools whenever they would provide more accurate, current, or detailed information than your knowledge alone",
      );
      builder.addLine(
        "- When a request requires specific data retrieval, computation, or external actions, prioritize relevant tools",
      );
      builder.addLine(
        "- For creative or reasoning tasks, leverage your own capabilities first, then enhance with tools as needed",
      );
      builder.addLine(
        "- If tools return unexpected or incomplete results, adapt your approach or transparently explain limitations",
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

      builder.startSection("Response Format");
      builder.addLine("- Use clear markdown formatting for readability");
      builder.addLine(
        "- For complex tool operations, briefly explain your reasoning or approach",
      );
      builder.addLine(
        "- After using tools, always provide a natural language summary or response",
      );
      builder.addLine(
        "- Balance technical detail with accessibility based on the user's expertise level",
      );
    }

    return builder.build();
  } catch (error) {
    logger.error("Error generating standard prompt", { error });
    return "";
  }
}
