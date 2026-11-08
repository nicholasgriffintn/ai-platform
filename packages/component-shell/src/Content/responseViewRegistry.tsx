import type { CustomResponseViewRegistry } from "@ngriffin_uk/polychat-component-content";
import { sharedResponseViews } from "@ngriffin_uk/polychat-component-conversation";

import { DelegationTimelineView } from "../Delegations/DelegationTimelineView.js";
import { BrowserSessionView } from "./BrowserSessionView.js";
import { CapabilityDiscoveryView } from "./CapabilityDiscoveryView.js";
import { McpAppMessageView } from "./McpAppMessageView.js";
import { SecretRequestView } from "./SecretRequestView.js";
import { SiteMessageView } from "./SiteMessageView.js";

export const responseViewRegistry: CustomResponseViewRegistry = {
  ...sharedResponseViews,
  browser_session: ({ data, onToolInteraction }) => (
    <BrowserSessionView data={data} onToolInteraction={onToolInteraction} />
  ),
  capability_discovery: ({ data }) => <CapabilityDiscoveryView data={data} />,
  mcp_app: ({ data, onToolInteraction }) => (
    <McpAppMessageView data={data} onToolInteraction={onToolInteraction} />
  ),
  delegation_card: ({ data, onToolInteraction }) => (
    <DelegationTimelineView data={data} onToolInteraction={onToolInteraction} />
  ),
  secret_request: ({ data, onToolInteraction }) => (
    <SecretRequestView data={data} onToolInteraction={onToolInteraction} />
  ),
  site_preview: ({ data, embedded }) => <SiteMessageView data={data} embedded={embedded} />,
};
