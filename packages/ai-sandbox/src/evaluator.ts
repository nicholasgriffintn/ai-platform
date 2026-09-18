import {
  DEFAULT_COMPATIBILITY_DATE,
  outboundNeedsGateway,
  parseEvaluationOutcome,
  renderEvaluationTemplate,
  renderToolProxySource,
  SandboxCancellationError,
  SandboxError,
  SandboxTimeoutError,
  TOOLS_ORIGIN,
  throwIfAborted,
  workerCodeId,
  type OutboundGatewayProps,
  type WorkerCodeSpec,
} from "@ngriffin_uk/polychat-library-sandbox";
import { abortable } from "@ngriffin_uk/polychat-utility-core";

import {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  resolveEvaluateOptions,
  type ResolvedEvaluateOptions,
} from "./evaluate-options.js";
import { registerToolInvocation, type ToolInvocationHandle } from "./tool-invocations.js";
import type {
  EvaluateOptions,
  EvaluateResult,
  Evaluator,
  EvaluatorOptions,
  OutboundFetcher,
} from "./types.js";

const RUN_URL = "https://evaluation.polychat.invalid/run";

function buildSpec(
  options: ResolvedEvaluateOptions,
  props: OutboundGatewayProps,
  gateway: OutboundFetcher | null | undefined,
  compatibilityDate: string,
): WorkerCodeSpec {
  const preamble = options.tools
    ? renderToolProxySource({
        tools: options.tools.definitions,
        binding: options.tools.binding,
        toolsOrigin: props.toolsOrigin,
      })
    : undefined;
  const template = renderEvaluationTemplate({
    module: options.module,
    script: options.script,
    preamble,
    envKeys: Object.keys(options.env),
  });

  return {
    mainModule: template.mainModule,
    modules: template.modules,
    compatibilityDate,
    compatibilityFlags: options.compatibilityFlags,
    limits: {
      cpuMs: options.limits?.cpuMs ?? options.timeoutMs,
      subRequests: options.limits?.subRequests,
    },
    env: options.env,
    globalOutbound: gateway,
  };
}

function runSignal(timeoutMs: number, signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);

  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function describeFailure(error: unknown, signal: AbortSignal, timeoutMs: number): SandboxError {
  if (error instanceof SandboxError) {
    return error;
  }

  if (signal.aborted) {
    return signal.reason instanceof DOMException && signal.reason.name === "TimeoutError"
      ? new SandboxTimeoutError(`Evaluation exceeded ${timeoutMs}ms`)
      : new SandboxCancellationError();
  }

  return new SandboxError(
    "execution_failed",
    error instanceof Error ? error.message : "The sandbox failed to run the script",
  );
}

export function createEvaluator(config: EvaluatorOptions): Evaluator {
  const compatibilityDate = config.compatibilityDate ?? DEFAULT_COMPATIBILITY_DATE;
  const bounds = {
    defaultTimeoutMs: config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxTimeoutMs: config.maxTimeoutMs ?? MAX_TIMEOUT_MS,
  };

  async function evaluate(input: EvaluateOptions): Promise<EvaluateResult> {
    const options = resolveEvaluateOptions(input, bounds);

    throwIfAborted(options.signal);

    const invocation: ToolInvocationHandle | null = options.tools
      ? registerToolInvocation(options.tools.invoke)
      : null;

    try {
      const props: OutboundGatewayProps = {
        allowlist: options.network,
        toolsOrigin: TOOLS_ORIGIN,
        invocationId: invocation?.id,
      };
      const needsGateway = outboundNeedsGateway(props);

      if (needsGateway && !config.gateway) {
        throw new SandboxError(
          "gateway_unavailable",
          "This runtime has no outbound gateway, so tools and host allowlists are unavailable",
        );
      }

      const gateway = needsGateway
        ? config.gateway?.(props)
        : options.network === "all"
          ? undefined
          : null;
      const spec = buildSpec(options, props, gateway, compatibilityDate);
      const cached = options.isolation === "cached" && !needsGateway;
      const isolateId = await workerCodeId(spec);
      const stub = cached ? config.loader.get(isolateId, () => spec) : config.loader.load(spec);
      const signal = runSignal(options.timeoutMs, options.signal);

      try {
        const response = await abortable(
          stub.getEntrypoint().fetch(RUN_URL, { method: "POST", signal }),
          signal,
        );
        const outcome = parseEvaluationOutcome(await abortable(response.json(), signal));

        return { ...outcome, isolateId, cached, toolCalls: invocation?.calls ?? [] };
      } catch (error) {
        throw describeFailure(error, signal, options.timeoutMs);
      }
    } finally {
      invocation?.release();
    }
  }

  return { evaluate };
}
