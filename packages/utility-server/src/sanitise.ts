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
    .replace(/<\/?(?:INST|system|assistant|human|user|ai)[^>]*>/gi, "")
    .replace(/\[\/?(?:INST|system|assistant|human|user|ai)\]/gi, "")
    .replace(/<\/?s>/gi, "")
    .replace(/{{/g, "{ {")
    .replace(/}}/g, "} }")
    .replace(
      /<([a-zA-Z][a-zA-Z0-9]*(\s+[a-zA-Z][a-zA-Z0-9]*=("[^"]*"|'[^']*'|[^>"'\s]+))*)\s*\/?>/g,
      "`&lt;$1&gt;`",
    )
    .replace(/[ \t]+/g, " ");

  const result = sanitised.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
    return codeBlocks[Number.parseInt(index)];
  });

  return result.trim();
}
