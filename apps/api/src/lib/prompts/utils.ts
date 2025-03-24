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

export function getArtifactInstructions(
  supportsArtifacts = false,
  forCode = false,
): string {
  if (!supportsArtifacts) return "";

  return forCode
    ? `
You can create and reference artifacts for code and other technical content. Artifacts are ideal for substantial, self-contained code that users might modify or reuse.

Good code artifacts are:
- Complete, working solutions (>15 lines)
- Self-contained scripts or modules
- Code intended for reuse or modification
- Well-structured implementations with proper organization

Don't use artifacts for:
- Simple one-liners or small examples
- Code snippets used to illustrate a concept
- Minor modifications to existing code
- Incomplete code fragments

When creating a code artifact:
1. First determine if the code is substantial and self-contained enough for an artifact.
2. Wrap the content in <artifact> tags with these attributes:
   - identifier: A descriptive id using kebab-case (e.g., "sorting-algorithm")
   - type: Use "application/code" for code with a language attribute
   - title: A brief title describing what the code does

Example code artifact:
<artifact identifier="factorial-script" type="application/code" language="python" title="Recursive factorial implementation">
def factorial(n):
    if n == 0:
        return 1
    else:
        return n * factorial(n - 1)
        
# Example usage
result = factorial(5)
print(f"Factorial of 5 is {result}")
</artifact>

You can also create other artifact types when appropriate:
- "text/markdown" for documentation
- "text/html" for web content
- "image/svg+xml" for diagrams
- "application/mermaid" for flowcharts and diagrams
`
    : `
You can create and reference artifacts during conversations. Artifacts are for substantial, self-contained content that might be modified or reused.

Good artifacts are:
- Substantial content (>15 lines)
- Self-contained content that can be understood without conversation context
- Content intended for eventual use outside the conversation
- Content likely to be referenced or reused

Don't use artifacts for:
- Simple, short content or brief code snippets
- Primarily explanatory or illustrative content
- Suggestions or feedback on existing artifacts
- Content dependent on the conversation context

When creating an artifact:
1. First determine if it's artifact-worthy based on the criteria above.
2. Wrap the content in <artifact> tags with these attributes:
   - identifier: A descriptive id using kebab-case (e.g., "example-code-snippet")
   - type: Specifies the content type:
     - "application/code" for code, with a language attribute
     - "text/markdown" for formatted documents
     - "text/html" for HTML content
     - "image/svg+xml" for SVG images
     - "application/mermaid" for Mermaid diagrams
   - title: A brief title describing the content

Example artifact:
<artifact identifier="factorial-script" type="application/code" language="python" title="Simple factorial script">
def factorial(n):
    if n == 0:
        return 1
    else:
        return n * factorial(n - 1)
</artifact>
`;
}

/**
 * Return an empty prompt string
 */
export function emptyPrompt(): string {
  return "";
}
