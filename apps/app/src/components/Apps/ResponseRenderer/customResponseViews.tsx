import {
	type CustomResponseViewRegistry,
	TutorView,
	WeatherView,
	WebSearchView,
} from "@ngriffin_uk/polychat-component-content";

import { AddReasoningStepView } from "./CustomView/Views/AddReasoningStepView";
import { CapabilityDiscoveryView } from "./CustomView/Views/CapabilityDiscoveryView";
import { ResearchView } from "./CustomView/Views/ResearchView";
import { SandboxView } from "./CustomView/Views/SandboxView";

/**
 * Every tool response the web host can render. Views without host dependencies ship inside
 * `@ngriffin_uk/polychat-component-content`; the rest live here because they need app data.
 */
export const customResponseViews: CustomResponseViewRegistry = {
	web_search: ({ data, embedded, onToolInteraction }) => (
		<WebSearchView data={data as never} embedded={embedded} onToolInteraction={onToolInteraction} />
	),
	tutor: ({ data, embedded }) => <TutorView data={data as never} embedded={embedded} />,
	get_weather: ({ data, embedded }) => <WeatherView data={data as never} embedded={embedded} />,
	discover_capabilities: ({ data }) => <CapabilityDiscoveryView data={data as never} />,
	research: ({ data, embedded }) => <ResearchView data={data as never} embedded={embedded} />,
	add_reasoning_step: ({ data, embedded }) => (
		<AddReasoningStepView data={data as never} embedded={embedded} />
	),
	sandbox_plan: ({ data }) => <SandboxView type="sandbox_plan" data={data as never} />,
	sandbox_event: ({ data }) => <SandboxView type="sandbox_event" data={data as never} />,
	sandbox_result: ({ data }) => <SandboxView type="sandbox_result" data={data as never} />,
};
