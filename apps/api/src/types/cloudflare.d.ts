import type { OutboundGateway } from "@ngriffin_uk/polychat-ai-sandbox/worker";

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      mainModule: {
        OutboundGateway: typeof OutboundGateway;
      };
    }
  }
}
