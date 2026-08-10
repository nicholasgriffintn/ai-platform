import { WorkOverview } from "~/components/Work/WorkOverview";

export function meta() {
	return [
		{ title: "Workspaces - Polychat" },
		{
			name: "description",
			content: "Organise shared projects, conversations, and capabilities in Polychat Work.",
		},
	];
}

export default function WorkPage() {
	return <WorkOverview />;
}
