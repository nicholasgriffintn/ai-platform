import { AttentionPage } from "@ngriffin_uk/polychat-component-shell";

export function meta() {
  return [
    { title: "Attention - Polychat" },
    {
      name: "description",
      content: "Everything waiting on you across Chat and every workspace you can access.",
    },
  ];
}

export default function ChatAttentionPage() {
  return <AttentionPage />;
}
