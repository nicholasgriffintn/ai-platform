export const RELEASE_REPORT =
  "Release report for Maintainers: the interrupted stream was recovered with validation evidence.";

export function resolveProjectTaskModelResponse(body) {
  const answered = body.messages?.some(
    (message) =>
      typeof message.content === "string" &&
      message.content.includes("Answers to the agent's questions:") &&
      message.content.includes("Who should receive the release report?"),
  );

  if (!answered) {
    return null;
  }

  const delivered = body.messages.some(
    (message) => message.role === "assistant" && message.content === RELEASE_REPORT,
  );
  const completed = body.messages.some(
    (message) => message.role === "tool" && message.name === "complete_goal",
  );

  return {
    content: RELEASE_REPORT,
    toolCall:
      delivered && !completed
        ? {
            id: "e2e-release-goal-complete",
            type: "function",
            function: {
              name: "complete_goal",
              arguments: JSON.stringify({
                summary: "Collected the audience and scope and wrote the release report.",
                evidence: [
                  {
                    claim: "The report reflects the recorded audience and scope.",
                    route: "Read the submitted question answers and wrote the report.",
                    evidence_surface: "The preceding assistant report and recorded user answers.",
                    status: "confirmed",
                  },
                ],
              }),
            },
          }
        : null,
  };
}
