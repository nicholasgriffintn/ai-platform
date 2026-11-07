import type {
  CustomResponseViewProps,
  CustomResponseViewRegistry,
} from "@ngriffin_uk/polychat-component-content";
import { lazy, Suspense } from "react";

export const responseViewNames = [
  "approval_request",
  "browser_session",
  "capability_discovery",
  "computer_observation",
  "computer_takeover",
  "content_extract",
  "conversation_search",
  "council_conclusion",
  "council_member_picker",
  "council_review",
  "council_turn",
  "delegation_card",
  "document_output",
  "document_search",
  "evidence_audit",
  "list_tasks",
  "mcp_app",
  "project_task_list",
  "research",
  "sandbox_event",
  "sandbox_plan",
  "sandbox_result",
  "saved_note",
  "second_opinion",
  "second_opinion_turn",
  "site_preview",
  "user_question",
  "weather",
  "web_search",
  "work_output",
] as const;

const loadResponseViewRegistry = () => import("./responseViewRegistry.js");

const LazyResponseView = lazy(() =>
  loadResponseViewRegistry().then(({ responseViewRegistry }) => ({
    default: ({ viewName, ...props }: CustomResponseViewProps & { viewName: string }) =>
      responseViewRegistry[viewName]?.(props) ?? null,
  })),
);

export function preloadResponseViews(): void {
  void loadResponseViewRegistry();
}

export const customResponseViews: CustomResponseViewRegistry = Object.fromEntries(
  responseViewNames.map((viewName) => [
    viewName,
    (props: CustomResponseViewProps) => (
      <Suspense fallback={null}>
        <LazyResponseView viewName={viewName} {...props} />
      </Suspense>
    ),
  ]),
);
