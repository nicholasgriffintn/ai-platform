import { WorkOverview } from "@ngriffin_uk/polychat-component-shell";

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
