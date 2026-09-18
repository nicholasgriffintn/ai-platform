import type {
  CodeModeToolDescription,
  EvaluationOutcome,
  OutboundAllowlist,
  OutboundFetcher,
  OutboundGatewayProps,
  WorkerLimits,
} from "@ngriffin_uk/polychat-library-sandbox";

export type EvaluateEnvValue = string | number | boolean | null;

export type ToolInvoker = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface EvaluateTools {
  definitions: readonly CodeModeToolDescription[];
  invoke: ToolInvoker;
  binding?: string;
}

export interface EvaluateOptions {
  script: string;
  module?: string;
  env?: Record<string, EvaluateEnvValue>;
  timeoutMs?: number;
  limits?: WorkerLimits;
  compatibilityFlags?: string[];
  network?: OutboundAllowlist;
  tools?: EvaluateTools;
  isolation?: "fresh" | "cached";
  signal?: AbortSignal;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export type EvaluateResult = EvaluationOutcome & {
  isolateId: string;
  cached: boolean;
  toolCalls: ToolCallRecord[];
};

export type EvaluationWorkerCode = Omit<WorkerLoaderWorkerCode, "globalOutbound"> & {
  globalOutbound?: OutboundFetcher | null;
};

export type { OutboundFetcher };

export type OutboundGatewayFactory = (props: OutboundGatewayProps) => OutboundFetcher;

export interface EvaluationEntrypoint {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface EvaluationIsolate {
  getEntrypoint(): EvaluationEntrypoint;
}

export interface EvaluationLoader {
  load(code: EvaluationWorkerCode): EvaluationIsolate;
  get(
    name: string,
    getCode: () => EvaluationWorkerCode | Promise<EvaluationWorkerCode>,
  ): EvaluationIsolate;
}

export interface EvaluatorOptions {
  loader: EvaluationLoader;
  gateway?: OutboundGatewayFactory;
  compatibilityDate?: string;
  defaultTimeoutMs?: number;
  maxTimeoutMs?: number;
}

export interface Evaluator {
  evaluate(options: EvaluateOptions): Promise<EvaluateResult>;
}
