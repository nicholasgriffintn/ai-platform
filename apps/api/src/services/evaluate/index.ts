import {
  createEvaluator,
  type Evaluator,
  type OutboundGatewayFactory,
} from "@ngriffin_uk/polychat-ai-sandbox";

import type { IEnv } from "~/types";

export { evaluateWithTools, type EvaluateWithToolsOptions } from "./tools";

export interface ResolveEvaluatorOptions {
  env: IEnv;
  outboundGateway?: OutboundGatewayFactory;
}

export function resolveEvaluator(options: ResolveEvaluatorOptions): Evaluator | null {
  if (!options.env.LOADER) {
    return null;
  }

  return createEvaluator({
    loader: options.env.LOADER,
    gateway: options.outboundGateway,
  });
}
