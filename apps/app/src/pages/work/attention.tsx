import { AttentionPage } from "@ngriffin_uk/polychat-component-shell";

export function meta() {
  return [
    { title: "Inbox - Polychat" },
    {
      name: "description",
      content: "Decisions, approvals and updates waiting on you across your workspaces.",
    },
  ];
}

export default function WorkAttentionPage() {
  return <AttentionPage surface="work" />;
}
