import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { JsonView } from "../JsonView";
import { AddReasoningStepView } from "./Views/AddReasoningStepView";
import { TutorView } from "./Views/TutorView";
import { WebSearchView } from "./Views/WebSearchView";
import { ResearchView } from "./Views/ResearchView";

export function CustomView({
  messageContent,
  data,
  embedded,
  onToolInteraction,
}: {
  messageContent: string;
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

  if (data.name === "research") {
    return <ResearchView data={customData} embedded={embedded} />;
  }

  if (data.name === "tutor") {
    return <TutorView data={customData} embedded={embedded} />;
  }

  if (data.name === "add_reasoning_step") {
    return <AddReasoningStepView data={customData} embedded={embedded} />;
  }

  console.info(
    "ResponseRenderer custom response -> it's on you now!",
    customData,
  );
  return (
    <>
      <JsonView data={customData} />
      {typeof messageContent === "string" && (
        <div className="mt-6">
          <MemoizedMarkdown>{messageContent}</MemoizedMarkdown>
        </div>
      )}
    </>
  );
}
