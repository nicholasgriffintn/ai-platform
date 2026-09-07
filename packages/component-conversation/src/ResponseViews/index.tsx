import {
  ApprovalRequestView,
  CouncilMemberPickerView,
  type CustomResponseViewRegistry,
  PanelConclusionView,
  PanelTurnView,
  UserQuestionView,
  WeatherView,
  WebSearchView,
} from "@ngriffin_uk/polychat-component-content";

import { DocumentSearchView } from "./DocumentSearchView.js";
import { ProjectTaskListView } from "./ProjectTaskListView.js";
import { ResearchView } from "./ResearchView.js";
import { SandboxView } from "./SandboxView.js";

export { DocumentSearchView, ProjectTaskListView, ResearchView, SandboxView };

export const sharedResponseViews: CustomResponseViewRegistry = {
  approval_request: ({ data, embedded, onToolInteraction }) => (
    <ApprovalRequestView data={data} embedded={embedded} onToolInteraction={onToolInteraction} />
  ),
  council_conclusion: ({ data, embedded }) => (
    <PanelConclusionView data={data} embedded={embedded} heading="Council conclusion" />
  ),
  council_turn: ({ data, embedded }) => (
    <PanelTurnView data={data} embedded={embedded} fallbackName="Council member" />
  ),
  council_member_picker: ({ data, embedded, onToolInteraction }) => (
    <CouncilMemberPickerView
      data={data}
      embedded={embedded}
      onToolInteraction={onToolInteraction}
    />
  ),
  document_search: ({ data }) => <DocumentSearchView data={data} />,
  list_tasks: ({ data }) => <ProjectTaskListView data={data} />,
  project_task_list: ({ data }) => <ProjectTaskListView data={data} />,
  research: ({ data, embedded }) => <ResearchView data={data} embedded={embedded} />,
  sandbox_plan: ({ data }) => <SandboxView type="sandbox_plan" data={data as never} />,
  sandbox_event: ({ data }) => <SandboxView type="sandbox_event" data={data as never} />,
  sandbox_result: ({ data }) => <SandboxView type="sandbox_result" data={data as never} />,
  second_opinion: ({ data, embedded }) => (
    <PanelConclusionView data={data} embedded={embedded} heading="Second opinion" />
  ),
  second_opinion_turn: ({ data, embedded }) => (
    <PanelTurnView data={data} embedded={embedded} fallbackName="Reviewer" />
  ),
  user_question: ({ data, embedded, onToolInteraction }) => (
    <UserQuestionView data={data} embedded={embedded} onToolInteraction={onToolInteraction} />
  ),
  weather: ({ data, embedded }) => <WeatherView data={data} embedded={embedded} />,
  web_search: ({ data, embedded, onToolInteraction, toolName }) => (
    <WebSearchView
      data={data}
      embedded={embedded}
      onToolInteraction={onToolInteraction}
      toolName={toolName}
    />
  ),
};
