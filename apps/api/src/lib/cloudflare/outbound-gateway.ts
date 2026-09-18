import type { OutboundGatewayFactory } from "@ngriffin_uk/polychat-ai-sandbox";
import { SandboxError } from "@ngriffin_uk/polychat-library-sandbox";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

function hasLoopbackExports(value: unknown): value is ExecutionContext {
  return isRecord(value) && isRecord(value.exports);
}

export function loopbackOutboundGateway(executionContext: () => unknown): OutboundGatewayFactory {
  return (props) => {
    const context = executionContext();
    const gateway = hasLoopbackExports(context) ? context.exports.OutboundGateway : undefined;

    if (!gateway) {
      throw new SandboxError(
        "gateway_unavailable",
        "The outbound gateway is only available inside the Workers runtime",
      );
    }

    return gateway({ props });
  };
}
