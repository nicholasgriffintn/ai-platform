export interface AuthoredSkillDocumentParts {
  frontmatter: string;
  instructions: string;
}

export function splitAuthoredSkillDocument(content: string): AuthoredSkillDocumentParts {
  const match = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/);

  if (!match) {
    return { frontmatter: "", instructions: content };
  }

  return {
    frontmatter: match[1] ?? "",
    instructions: (match[2] ?? "").trim(),
  };
}

export function replaceAuthoredSkillInstructions(content: string, instructions: string): string {
  const parts = splitAuthoredSkillDocument(content);

  return `${parts.frontmatter}${instructions.trim()}\n`;
}
