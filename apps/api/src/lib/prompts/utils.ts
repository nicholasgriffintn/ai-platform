export function getResponseStyle(response_mode = "normal"): {
  responseStyle: string;
  problemBreakdownInstructions?: string;
  answerFormatInstructions?: string;
} {
  switch (response_mode) {
    case "concise":
      return {
        responseStyle:
          "Your responses should be concise, specific, friendly, and helpful. Aim for 1-2 sentences when possible.",
        problemBreakdownInstructions:
          "Keep your problem breakdown brief, focusing only on the most critical aspects of the problem.",
        answerFormatInstructions:
          "Provide a concise solution with minimal explanation, focusing on the code itself.",
      };
    case "explanatory":
      return {
        responseStyle:
          "Your responses should be detailed and explanatory, breaking down concepts thoroughly and providing comprehensive information. Include examples where helpful.",
        problemBreakdownInstructions:
          "Provide a thorough problem breakdown with detailed explanations of your thought process and approach.",
        answerFormatInstructions:
          "Explain your code in detail, including the reasoning behind your implementation choices and how each part works.",
      };
    case "formal":
      return {
        responseStyle:
          "Your responses should be formal, professional, and structured. Use proper terminology and maintain a respectful, business-like tone.",
        problemBreakdownInstructions:
          "Structure your problem breakdown formally, using proper technical terminology and a methodical approach.",
        answerFormatInstructions:
          "Present your solution in a formal, structured manner with appropriate technical terminology and documentation.",
      };
    default:
      return {
        responseStyle:
          "Your responses should be conversational, balanced in detail, friendly, and helpful.",
        problemBreakdownInstructions:
          "Provide a balanced problem breakdown that covers the important aspects without being overly verbose.",
        answerFormatInstructions:
          "Balance code with explanation, providing enough context to understand the solution without overwhelming detail.",
      };
  }
}

export function getArtifactExample(
  supportsArtifacts = false,
  forCode = false,
): string {
  if (!supportsArtifacts) return "";

  return forCode
    ? `Example code artifact:
<artifact identifier="factorial-script" type="application/code" language="python" title="Recursive factorial implementation">
def factorial(n):
    if n == 0:
        return 1
    else:
        return n * factorial(n - 1)
        
# Example usage
result = factorial(5)
print(f"Factorial of 5 is {result}")
</artifact>`
    : `Example artifact:
<artifact identifier="factorial-script" type="application/code" language="python" title="Simple factorial script">
def factorial(n):
    if n == 0:
        return 1
    else:
        return n * factorial(n - 1)
</artifact>`;
}

export function getArtifactInstructions(
  supportsArtifacts = false,
  forCode = false,
  startIndex = 1,
): string {
  if (!supportsArtifacts) return "";

  return forCode
    ? `${startIndex}. When creating code artifacts:
   a. Only use artifacts for substantial content:
      - Complete, working solutions (>15 lines)
      - Self-contained scripts or modules
      - Code intended for reuse or modification
   b. Don't use artifacts for simple snippets, examples, or incomplete code
   c. Structure the artifact with these attributes:
      - identifier: A descriptive kebab-case id (e.g., "sorting-algorithm")
      - type: Use "application/code" with a language attribute
      - title: A brief description of what the code does
   d. Consider other artifact types when appropriate:
      - "text/markdown" for documentation
      - "text/html" for web content
      - "image/svg+xml" for diagrams
      - "application/mermaid" for flowcharts`
    : `${startIndex}. When creating artifacts:
   a. Only use artifacts for substantial content:
      - Self-contained content (>15 lines)
      - Content that can be understood without conversation context
      - Content intended for use outside the conversation
   b. Don't use artifacts for simple snippets, explanations, or context-dependent content
   c. Structure the artifact with these attributes:
      - identifier: A descriptive kebab-case id (e.g., "example-code-snippet")
      - type: Appropriate content type ("application/code", "text/markdown", etc.)
      - title: A brief description of the content`;
}

/**
 * Return an empty prompt string
 */
export function emptyPrompt(): string {
  return "";
}
