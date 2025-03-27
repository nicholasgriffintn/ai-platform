import type { IBody, IUser } from "~/types";
import { PromptBuilder } from "./builder";
import {
  getArtifactExample,
  getArtifactInstructions,
  getResponseStyle,
} from "./utils";

export function returnStandardPrompt(
  request: IBody,
  user?: IUser,
  supportsFunctions?: boolean,
  supportsArtifacts?: boolean,
  hasThinking?: boolean,
): string {
  try {
    const latitude = request.location?.latitude || user?.latitude;
    const longitude = request.location?.longitude || user?.longitude;
    const date = request.date || new Date().toISOString().split("T")[0];
    const response_mode = request.response_mode || "normal";

    const { responseStyle } = getResponseStyle(response_mode);

    const builder = new PromptBuilder(
      "You are an AI assistant helping with daily tasks.",
    )
      .add(responseStyle)
      .startSection("Important context")
      .addIf(!!date, `<current_date>${date}</current_date>`)
      .addIf(
        !!latitude && !!longitude,
        `<user_location><latitude>${latitude}</latitude><longitude>${longitude}</longitude></user_location>`,
      )
      .startSection("Instructions")
      .addLine("1. Read and understand questions carefully.")
      .addLine("2. If unclear, ask for clarification.");

    if (!hasThinking) {
      builder
        .addLine(
          "3. Analyze the question and context thoroughly before answering.",
        )
        .addLine("   - Identify key information from the user's question.")
        .addIf(
          supportsFunctions,
          "   - Determine whether the query can be resolved directly or if a tool is required. Use the description of the tool to help you decide.",
        )
        .addIf(
          supportsFunctions,
          "   - Use a tool only if it directly aligns with the user's request or is necessary to resolve the query accurately and efficiently.",
        )
        .addIf(
          supportsFunctions,
          "   - If the task can be effectively answered without a tool, prioritize a manual response.",
        )
        .addIf(
          supportsArtifacts,
          "   - Determine if the response would benefit from using an artifact based on the criteria above.",
        )
        .addLine("   - It's OK for this section to be quite long.");
    }

    let responseModeInstruction = "";
    if (response_mode === "concise") {
      responseModeInstruction =
        "If you're confident in your answer, provide a response in 1-2 sentences.";
    } else if (response_mode === "explanatory") {
      responseModeInstruction =
        "Provide a thorough response with explanations and context.";
    } else if (response_mode === "formal") {
      responseModeInstruction =
        "Provide a well-structured, professional response with appropriate terminology.";
    } else {
      responseModeInstruction =
        "If you're confident in your answer, provide a balanced response with appropriate detail.";
    }

    builder
      .addLine(`${hasThinking ? "3" : "4"}. ${responseModeInstruction}`)
      .addLine(
        `${hasThinking ? "4" : "5"}. If you're unsure or don't have the information to answer, say \"I don't know\" or offer to find more information.`,
      )
      .addLine(
        `${hasThinking ? "5" : "6"}. Always respond in plain text, not computer code.`,
      )
      .addIf(
        supportsArtifacts,
        getArtifactInstructions(supportsArtifacts, false, hasThinking ? 6 : 7),
      );

    let conversationStyle = "";
    if (response_mode === "concise") {
      conversationStyle =
        "Keep the conversation brief while still being helpful.";
    } else if (response_mode === "explanatory") {
      conversationStyle =
        "Provide comprehensive information with examples where helpful.";
    } else if (response_mode === "formal") {
      conversationStyle =
        "Maintain a professional tone throughout your response.";
    } else {
      conversationStyle = "Balance brevity with helpfulness.";
    }

    builder
      .addLine(`${hasThinking ? "6" : "7"}. ${conversationStyle}`)
      .startSection("Example output");

    if (!hasThinking) {
      builder
        .addLine("Example analysis:")
        .addLine("<analysis>")
        .addLine(
          "[Your detailed analysis of the question, considering context and required information]",
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

    builder.addLine(`[Your ${answerStyle} response to the user's question]`);

    if (supportsArtifacts) {
      builder
        .addLine("When appropriate for substantial content:")
        .addLine(getArtifactExample(supportsArtifacts, false));
    }

    builder.addLine("</answer>");

    return builder.build();
  } catch (error) {
    console.error(error);
    return "";
  }
}
