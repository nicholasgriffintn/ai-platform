export class PromptBuilder {
  private parts: string[] = [];
  private indentLevel = 0;

  constructor(private initialPrompt = "") {
    if (initialPrompt) {
      this.parts.push(initialPrompt);
    }
  }

  add(text: string): PromptBuilder {
    if (text) {
      this.parts.push(text);
    }
    return this;
  }

  addIf(condition: boolean, text: string): PromptBuilder {
    if (condition && text) {
      this.parts.push(text);
    }
    return this;
  }

  addConditional(
    condition: boolean,
    trueText: string,
    falseText = "",
  ): PromptBuilder {
    this.parts.push(condition ? trueText : falseText);
    return this;
  }

  addLine(text = ""): PromptBuilder {
    this.parts.push(`${text}\n`);
    return this;
  }

  startSection(title?: string): PromptBuilder {
    this.parts.push("\n\n");
    if (title) {
      this.parts.push(`${title}:\n`);
    }
    return this;
  }

  indent(): PromptBuilder {
    this.indentLevel++;
    return this;
  }

  outdent(): PromptBuilder {
    if (this.indentLevel > 0) {
      this.indentLevel--;
    }
    return this;
  }

  build(): string {
    return this.parts.join("");
  }
}
