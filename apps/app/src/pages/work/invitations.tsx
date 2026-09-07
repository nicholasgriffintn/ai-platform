import { InvitationAcceptPage } from "@ngriffin_uk/polychat-component-shell";

export function meta() {
  return [
    { title: "Workspace invitation - Polychat" },
    { name: "description", content: "Accept a secure Polychat workspace invitation." },
  ];
}

export default function WorkspaceInvitationPage() {
  return <InvitationAcceptPage />;
}
