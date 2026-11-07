import { SharedPolisTown } from "@ngriffin_uk/polychat-component-shell";
import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { useParams } from "react-router";

export function meta() {
  return [
    { title: "A shared town - Polychat" },
    { name: "description", content: "Watch a simulated town back, hour by hour." },
  ];
}

export default function SharedPolisTownPage() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="h-dvh w-full bg-surface">
      {token ? (
        <SharedPolisTown token={token} />
      ) : (
        <PageStatus title="No such town" message="That share link is not valid." />
      )}
    </div>
  );
}
