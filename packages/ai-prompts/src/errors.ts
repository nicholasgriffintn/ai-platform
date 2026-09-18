export class PromptNotFoundError extends Error {
  constructor(id: string) {
    super(`Unknown prompt: ${id}`);
    this.name = "PromptNotFoundError";
  }
}

export class PromptRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptRenderError";
  }
}

export class PromptTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptTemplateError";
  }
}
