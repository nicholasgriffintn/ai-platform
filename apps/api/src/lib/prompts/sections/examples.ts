import { ResponseMode } from "../../../types";
import { PromptBuilder } from "../builder";
import { getArtifactExample } from "../utils";

interface StandardExampleOptions {
  supportsReasoning?: boolean;
  supportsArtifacts?: boolean;
  problemBreakdownInstructions: string;
  answerFormatInstructions: string;
}

interface CodingExampleOptions {
  supportsReasoning?: boolean;
  supportsArtifacts?: boolean;
  problemBreakdownInstructions: string;
  answerFormatInstructions: string;
  preferredLanguage?: string;
  responseMode?: ResponseMode;
}

export function buildStandardExampleOutputSection({
  supportsReasoning,
  supportsArtifacts,
  problemBreakdownInstructions,
  answerFormatInstructions,
}: StandardExampleOptions): string {
  const builder = new PromptBuilder()
    .addLine("Here is an example of the output you should provide:")
    .addLine("<example_output>");

  if (!supportsReasoning) {
    builder.addLine("<think>");
    builder.addLine(problemBreakdownInstructions);
    builder.addLine("</think>");
  }

  builder.addLine("<answer>");
  builder.addLine(answerFormatInstructions);

  if (supportsArtifacts) {
    builder.addLine(getArtifactExample(supportsArtifacts, false));
  }

  builder.addLine("</answer>").addLine("</example_output>").addLine();

  return builder.build();
}

export function buildCodingExampleOutputSection({
  supportsReasoning,
  supportsArtifacts,
  problemBreakdownInstructions,
  answerFormatInstructions,
  preferredLanguage,
  responseMode,
}: CodingExampleOptions): string {
  const proseLanguage = preferredLanguage || "the user's preferred language";
  const codeLanguagePlaceholder = "{{programming_language}}";

  const toneHint = (() => {
    switch (responseMode) {
      case "concise":
        return "<tone_hint>Keep explanations crisp and focus on the actionable answer.</tone_hint>";
      case "formal":
        return "<tone_hint>Use a formal register with precise technical phrasing.</tone_hint>";
      case "explanatory":
        return "<tone_hint>Provide an instructive tone, expanding on each major decision.</tone_hint>";
      default:
        return "";
    }
  })();

  const builder = new PromptBuilder()
    .addLine("Here is an example of the output you should provide:")
    .addLine("<example_output>")
    .addLine("<answer>")
    .addLine(
      "<introduction>Brief introduction addressing the user's question or request</introduction>",
    )
    .addLine();

  if (!supportsReasoning) {
    builder.addLine("<think>");
    builder.addLine(problemBreakdownInstructions);
    builder.addLine("</think>").addLine();
  }

  if (supportsArtifacts) {
    builder
      .addLine("<artifact_example>")
      .addLine(
        `<artifact identifier="solution-snippet" type="application/code" language="${codeLanguagePlaceholder}">`,
      )
      .addLine("// Place the final implementation in this artifact.")
      .addLine("</artifact>")
      .addLine(
        `<annotation>Reference the artifact in your prose and summarise its contents in ${proseLanguage}.</annotation>`,
      )
      .addLine(`<reference_note>${answerFormatInstructions}</reference_note>`)
      .addLine("</artifact_example>")
      .addLine(
        "<summary>Highlight what the artifact delivers and how the user can run or extend it.</summary>",
      );
  } else {
    builder
      .addLine("<solution>")
      .addLine(
        `<code_block language="${codeLanguagePlaceholder}">// Provide the final implementation here.</code_block>`,
      )
      .addLine("<explanation>")
      .addLine(
        `- Outline the main approach, including key helpers or data structures, using ${proseLanguage}.`,
      )
      .addLine(
        "- Note any assumptions or trade-offs that influenced the implementation.",
      )
      .addLine("</explanation>")
      .addLine("<reference_note>")
      .addLine(answerFormatInstructions)
      .addLine("</reference_note>")
      .addLine("</solution>");
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
    .addLine()
    .addLine("<validation>")
    .addLine(
      "- tests: Summarise the checks you ran (unit, integration, or manual) and their outcomes.",
    )
    .addLine(
      "- edge_cases: List critical scenarios the user should keep in mind.",
    )
    .addLine("</validation>")
    .addLine()
    .addLine(
      "<next_steps>Offer a helpful follow-up suggestion or optimisation when relevant.</next_steps>",
    );

  if (toneHint) {
    builder.addLine().addLine(toneHint);
  }

  builder.addLine("</answer>").addLine("</example_output>").addLine();

  return builder.build();
}
