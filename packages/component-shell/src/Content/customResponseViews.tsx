import type { CustomResponseViewRegistry } from "@ngriffin_uk/polychat-component-content";
import { sharedResponseViews } from "@ngriffin_uk/polychat-component-conversation";

import { DelegationTimelineView } from "../Delegations/DelegationTimelineView.js";
import { CapabilityDiscoveryView } from "./CapabilityDiscoveryView.js";
import { SiteMessageView } from "./SiteMessageView.js";

export const customResponseViews: CustomResponseViewRegistry = {
  ...sharedResponseViews,
  capability_discovery: ({ data }) => <CapabilityDiscoveryView data={data} />,
  delegation_card: ({ data, onToolInteraction }) => (
    <DelegationTimelineView data={data} onToolInteraction={onToolInteraction} />
  ),
  site_preview: ({ data, embedded }) => <SiteMessageView data={data} embedded={embedded} />,
};
