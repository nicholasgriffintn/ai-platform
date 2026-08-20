import {
  CouncilMemberPickerView,
  PanelTurnView,
  type CustomResponseViewRegistry,
  WeatherView,
  WebSearchView,
} from "@ngriffin_uk/polychat-component-content";

import { CapabilityDiscoveryView } from "./CustomView/Views/CapabilityDiscoveryView";
import { ResearchView } from "./CustomView/Views/ResearchView";
import { SandboxView } from "./CustomView/Views/SandboxView";

export const customResponseViews: CustomResponseViewRegistry = {
  web_search: ({ data, embedded, onToolInteraction }) => (
    <WebSearchView data={data} embedded={embedded} onToolInteraction={onToolInteraction} />
  ),
  get_weather: ({ data, embedded }) => <WeatherView data={data} embedded={embedded} />,
  council_turn: ({ data, embedded }) => (
    <PanelTurnView data={data} embedded={embedded} fallbackName="Council member" />
  ),
  second_opinion_turn: ({ data, embedded }) => (
    <PanelTurnView data={data} embedded={embedded} fallbackName="Reviewer" />
  ),
  select_council_members: ({ data, embedded, onToolInteraction }) => (
    <CouncilMemberPickerView
      data={data}
      embedded={embedded}
      onToolInteraction={onToolInteraction}
    />
  ),
  discover_capabilities: ({ data }) => <CapabilityDiscoveryView data={data} />,
  research: ({ data, embedded }) => <ResearchView data={data} embedded={embedded} />,
  sandbox_plan: ({ data }) => <SandboxView type="sandbox_plan" data={data as never} />,
  sandbox_event: ({ data }) => <SandboxView type="sandbox_event" data={data as never} />,
  sandbox_result: ({ data }) => <SandboxView type="sandbox_result" data={data as never} />,
};
