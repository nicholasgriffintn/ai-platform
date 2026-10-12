import type { HermesModelEgress } from "./harness/model-egress";

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      mainModule: {
        HermesModelEgress: typeof HermesModelEgress;
      };
    }
  }
}
