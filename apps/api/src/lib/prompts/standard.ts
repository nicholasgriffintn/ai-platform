import type { IBody, IUser, IUserSettings } from "~/types";
import { getLogger } from "../../utils/logger";
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
    const userNickname = userSettings?.nickname || null;
    const userJobRole = userSettings?.job_role || null;
    const userTraits = userSettings?.traits || null;
    const userPreferences = userSettings?.preferences || null;

    const latitude = request.location?.latitude || user?.latitude;
    const longitude = request.location?.longitude || user?.longitude;
    const date = request.date || new Date().toISOString().split("T")[0];
    const response_mode = request.response_mode || "normal";

    const { traits, preferences } = getResponseStyle(
      response_mode,
      hasThinking,
      supportsFunctions,
      supportsArtifacts,
    );

    const DEFAULT_TRAITS = traits;
    const DEFAULT_PREFERENCES = preferences;

    const builder = new PromptBuilder(
      "You are an AI assistant helping with daily tasks.",
    )
      .addLine(
        `Embody these traits in your responses: ${userTraits || DEFAULT_TRAITS}`,
      )
      .addLine(
        `Follow these guidelines when responding:\n${userPreferences || DEFAULT_PREFERENCES}`,
      )
      .startSection("Context")
      .addIf(!!userNickname, `<user_nickname>${userNickname}</user_nickname>`)
      .addIf(!!userJobRole, `<user_job_role>${userJobRole}</user_job_role>`)
      .addIf(!!date, `<current_date>${date}</current_date>`)
      .addIf(
        !!latitude && !!longitude,
        `<user_location><latitude>${latitude}</latitude><longitude>${longitude}</longitude></user_location>`,
      );

    builder.startSection("Example output");

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
    logger.error("Error generating standard prompt", { error });
    return "";
  }
}
