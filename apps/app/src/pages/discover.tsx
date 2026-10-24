import { ChatPlaceShell, DiscoverPage } from "@ngriffin_uk/polychat-component-shell";

export function meta() {
  return [
    { title: "Discover - Polychat" },
    {
      name: "description",
      content: "Your morning edition from Poly: a brief, topics, links and things worth doing.",
    },
  ];
}

export default function Discover() {
  return (
    <ChatPlaceShell>
      <DiscoverPage />
    </ChatPlaceShell>
  );
}
