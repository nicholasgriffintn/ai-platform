/**
 * Strip prompt-injection vectors from untrusted text before it reaches a provider.
 * Code blocks are lifted out first so fenced examples survive verbatim.
 */
export function sanitiseInput(input: string): string {
  const codeBlocks: string[] = [];
  let codeBlockCount = 0;

  const withoutCodeBlocks = input.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlockCount}__`;

    codeBlocks.push(match);
    codeBlockCount++;

    return placeholder;
  });

  const sanitised = withoutCodeBlocks
    // Remove instruction formats
    .replace(/<\/?(?:INST|system|assistant|human|user|ai)[^>]*>/gi, "")
    .replace(/\[\/?(?:INST|system|assistant|human|user|ai)\]/gi, "")
    // Remove sentinel tokens
    .replace(/<\/?s>/gi, "")
    // Escape template syntax
    .replace(/{{/g, "{ {")
    .replace(/}}/g, "} }")
    // Handle angle brackets that might be part of XML-style instructions
    .replace(
      /<([a-zA-Z][a-zA-Z0-9]*(\s+[a-zA-Z][a-zA-Z0-9]*=("[^"]*"|'[^']*'|[^>"'\s]+))*)\s*\/?>/g,
      "`&lt;$1&gt;`",
    )
    // Normalize whitespace (but preserve newlines)
    .replace(/[ \t]+/g, " ");

  const result = sanitised.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
    return codeBlocks[Number.parseInt(index)];
  });

  return result.trim();
}
