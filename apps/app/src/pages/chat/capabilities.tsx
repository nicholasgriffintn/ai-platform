import { CapabilityLibrary } from "~/components/Capabilities/CapabilityLibrary";
import { usePersonalCapabilityScope } from "~/components/Capabilities/useCapabilityLibraryController";

export function meta() {
	return [{ title: "Your capabilities - Polychat" }];
}

export default function PersonalCapabilitiesPage() {
	const scope = usePersonalCapabilityScope();

	return (
		<CapabilityLibrary
			scope={scope}
			title="Capabilities"
			subtitle="Apps, Recipes and Tools that can be used alongside the chat experience."
		/>
	);
}
