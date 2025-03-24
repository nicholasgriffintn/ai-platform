import type { IBody, IUser } from "~/types";
import { PromptBuilder } from "./builder";
import { getArtifactInstructions, getResponseStyle } from "./utils";

export function returnStandardPrompt(
  request: IBody,
  user?: IUser,
  supportsFunctions?: boolean,
  supportsArtifacts?: boolean,
): string {
  try {
    const latitude = request.location?.latitude || user?.latitude;
    const longitude = request.location?.longitude || user?.longitude;
    const date = request.date || new Date().toISOString().split("T")[0];
    const response_mode = request.response_mode || "normal";

    const { responseStyle } = getResponseStyle(response_mode);
    const artifactInstructions = getArtifactInstructions(supportsArtifacts);

    const builder = new PromptBuilder(
      "You are an AI personal assistant designed to help users with their daily tasks. ",
    )
      .add(responseStyle)
      .startSection("Here's important context for your interactions")
      .addIf(!!date, `\n<current_date>${date}</current_date>`)
      .addIf(
        !!latitude && !!longitude,
        `
<user_location>
  <user_latitude>${latitude}</user_latitude>
  <user_longitude>${longitude}</user_longitude>
</user_location>`,
      )
      .addIf(supportsArtifacts, artifactInstructions)
      .startSection("Instructions")
      .addLine("1. Read and understand the user's question carefully.")
      .addLine("2. If the question is unclear, politely ask for clarification.")
      .addLine(
        "3. Before answering, analyze the question and relevant context in <analysis> tags. In your analysis:",
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
      .addLine(`4. ${responseModeInstruction}`)
      .addLine(
        "5. If you're unsure or don't have the information to answer, say \"I don't know\" or offer to find more information.",
      )
      .addLine("6. Always respond in plain text, not computer code.");

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
      .addLine(`7. ${conversationStyle}`)
      .startSection("Example output structure")
      .addLine()
      .addLine("<analysis>")
      .addLine(
        "[Your detailed analysis of the question, considering context and required information]",
      )
      .addLine("</analysis>")
      .addLine()
      .addLine("<answer>");

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
        .addLine()
        .addLine("When appropriate for substantial content:")
        .addLine()
        .addLine(
          '<artifact identifier="example-content" type="text/markdown" title="Detailed information">',
        )
        .addLine(
          "[Substantial, self-contained content that can be referenced or reused]",
        )
        .addLine("</artifact>");
    }

    builder
      .addLine("</answer>")
      .startSection()
      .addLine(
        "Remember to use the analysis phase to ensure you're using the most up-to-date and relevant information for each query, rather than relying on previous conversation history.",
      );

    return builder.build();
  } catch (error) {
    console.error(error);
    return "";
  }
}
