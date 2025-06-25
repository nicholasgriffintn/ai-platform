export class ResearchError extends Error {
  public code: string;
  public details?: Record<string, any>;
  public retryable: boolean;
  public cause?: Error;
  public context?: ExecutionContext;

  constructor(options: {
    code: string;
    message: string;
    details?: Record<string, any>;
    retryable?: boolean;
    cause?: Error;
    context?: ExecutionContext;
  }) {
    super(options.message);
    this.name = "ResearchError";
    this.code = options.code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    this.context = options.context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ResearchError);
    }
  }
}
