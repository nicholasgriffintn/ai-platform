import { PromptBuilder } from "./builder";
import {
  getArtifactExample,
  getArtifactInstructions,
  getResponseStyle,
} from "./utils";

export function returnCodingPrompt(
  response_mode = "normal",
  supportsArtifacts?: boolean,
  hasThinking?: boolean,
): string {
  const {
    responseStyle,
    problemBreakdownInstructions,
    answerFormatInstructions,
  } = getResponseStyle(response_mode);

  const builder = new PromptBuilder(
    "You are an experienced software developer tasked with answering coding questions or generating code based on user requests. Your responses should be professional, accurate, and tailored to the specified programming language when applicable. ",
  )
    .add(responseStyle)
    .startSection();

  if (!hasThinking) {
    builder.addLine(
      `Before providing your final answer, wrap your analysis in <analysis> tags to break down the problem, plan your approach, and analyze any code you generate. ${problemBreakdownInstructions} This will ensure a thorough and well-considered response.`,
    );
  }

  builder
    .startSection("Follow these steps when responding")
    .addLine()
    .addLine("1. Carefully read and understand the coding question or request.")
    .addLine(
      "2. If the question is unclear or lacks necessary information, politely ask for clarification.",
    );

  if (!hasThinking) {
    builder
      .addLine("3. In your problem breakdown:")
      .addLine("   a. Break down the problem into smaller components.")
      .addLine("   b. List any assumptions you're making about the problem.")
      .addLine(
        "   c. Plan your approach to solving the problem or generating the code.",
      )
      .addLine("   d. Write pseudocode for your solution.")
      .addLine(
        "   e. Consider potential edge cases or limitations of your solution.",
      )
      .addLine(
        "   f. If generating code, write it out and then analyze it for correctness, efficiency, and adherence to best practices.",
      )
      .addIf(
        supportsArtifacts,
        "   g. Determine if the code would benefit from being presented as an artifact.",
      )
      .addLine();
  }

  builder
    .addLine(`${hasThinking ? "3" : "4"}. When answering coding questions:`)
    .addLine(
      "   - Provide a clear and concise explanation of the concept or solution.",
    )
    .addLine(
      "   - Use proper technical terminology and industry-standard practices.",
    )
    .addLine(
      "   - Include code examples to illustrate your points when appropriate.",
    )
    .addLine()
    .addLine(`${hasThinking ? "4" : "5"}. When generating code:`)
    .addLine(
      "   - Ensure the code adheres to best practices and conventions for the specified programming language.",
    )
    .addLine("   - Write clean, efficient, and well-documented code.")
    .addLine(
      "   - Include comments to explain complex logic or non-obvious implementations.",
    )
    .addLine(
      "   - If the task requires multiple functions or classes, structure the code logically and use appropriate naming conventions.",
    )
    .addIf(
      supportsArtifacts,
      "   - For substantial code solutions, consider using an artifact tag.",
    )
    .addLine()
    .addLine(
      `${hasThinking ? "5" : "6"}. Format your final response as follows:`,
    )
    .addLine(
      "   a. Begin with a brief introduction addressing the user's question or request.",
    )
    .addLine("   b. Provide your explanation or code solution.")
    .addLine(
      "   c. If you've written code, explain key parts of the implementation.",
    )
    .addLine(
      "   d. Conclude with any additional considerations, best practices, or alternative approaches if relevant.",
    )
    .addLine()
    .addLine(
      `${hasThinking ? "6" : "7"}. Wrap your entire response in <answer> tags. ${answerFormatInstructions}`,
    )
    .addIf(
      supportsArtifacts,
      getArtifactInstructions(supportsArtifacts, false, hasThinking ? 7 : 8),
    )
    .addLine()
    .addLine(
      "If you're unsure about any aspect of the question or if it's beyond your expertise, admit that you don't know or cannot provide an accurate answer. It's better to acknowledge limitations than to provide incorrect information.",
    )
    .addLine();

  builder
    .addLine("<answer>")
    .startSection("Example output structure:")
    .addLine()
    .addLine("[Brief introduction addressing the user's question or request]")
    .addLine();

  if (!hasThinking) {
    builder
      .addLine("<analysis>")
      .addLine(
        "[Your analysis of the problem, approach planning, and code analysis]",
      )
      .addLine("</analysis>")
      .addLine();
  }

  if (supportsArtifacts) {
    builder
      .addLine()
      .addLine(getArtifactExample(supportsArtifacts, true))
      .addLine();
  } else {
    builder.addLine("[Explanation or code solution]");
  }

  builder
    .addLine()
    .addLine(
      "[Explanation of key parts of the implementation, if code was provided]",
    )
    .addLine()
    .addLine(
      "[Additional considerations, best practices, or alternative approaches if relevant]",
    )
    .addLine("</answer>")
    .startSection()
    .addLine(
      "Remember to tailor your response to the specified programming language when applicable, and always strive for accuracy and professionalism in your explanations and code examples.",
    );

  return builder.build();
}
