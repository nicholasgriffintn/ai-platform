import { InvitationAcceptPage } from "~/components/Work/InvitationAcceptPage";

export function meta() {
	return [
		{ title: "Workspace invitation - Polychat" },
		{ name: "description", content: "Accept a secure Polychat workspace invitation." },
	];
}

export default function WorkspaceInvitationPage() {
	return <InvitationAcceptPage />;
}
