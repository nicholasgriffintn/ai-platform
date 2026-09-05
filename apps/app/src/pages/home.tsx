import { HomePage } from "~/components/Home/HomePage";

export function meta() {
  return [
    { title: "Polychat" },
    {
      name: "description",
      content:
        "Ask any model, keep every conversation, and bring your team into Work when a question becomes a project. One perch for chat, agents and shared projects.",
    },
  ];
}

export default function Home() {
  return <HomePage />;
}
