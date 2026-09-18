export type ToolErrorCode =
  | "duplicate_registration"
  | "unknown_category"
  | "unknown_tool"
  | "invalid_input"
  | "invalid_schema"
  | "missing_permissions";

export interface ToolValidationIssue {
  path: string;
  message: string;
}

export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly category?: string;
  readonly toolName?: string;
  readonly issues?: ToolValidationIssue[];
  readonly pattern?: string;

  constructor(
    code: ToolErrorCode,
    message: string,
    details: {
      category?: string;
      toolName?: string;
      issues?: ToolValidationIssue[];
      pattern?: string;
    } = {},
  ) {
    super(message);

    this.name = "ToolError";
    this.code = code;
    this.category = details.category;
    this.toolName = details.toolName;
    this.issues = details.issues;
    this.pattern = details.pattern;
  }
}

export function isToolError(error: unknown): error is ToolError {
  return error instanceof ToolError;
}
