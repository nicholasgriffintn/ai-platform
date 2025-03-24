import { JsonView } from "../JsonView";
import { TutorView } from "./Views/TutorView";
import { WebSearchView } from "./Views/WebSearchView";

export function CustomView({
  data,
  embedded,
  onToolInteraction,
}: {
  data: any;
  embedded: boolean;
  onToolInteraction?: (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => void;
}) {
  const customData = data.data || data;

  if (data.name === "web_search") {
    return (
      <WebSearchView
        data={customData}
        embedded={embedded}
        onToolInteraction={onToolInteraction}
      />
    );
  }

  if (data.name === "tutor") {
    return <TutorView data={customData} embedded={embedded} />;
  }

  console.info(
    "ResponseRenderer custom response -> it's on you now!",
    customData,
  );
  return <JsonView data={customData} />;
}
