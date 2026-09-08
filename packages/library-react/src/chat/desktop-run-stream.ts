import type { DesktopRun } from "@ngriffin_uk/polychat-library-chat";

export async function consumeDesktopRun(
  run: DesktopRun,
  onContent: (content: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const cancel = () => run.cancel();

  signal.addEventListener("abort", cancel, { once: true });
  let text = "";
  let completed = false;

  try {
    if (signal.aborted) {
      cancel();
      signal.throwIfAborted();
    }

    for await (const event of run.events) {
      signal.throwIfAborted();
      if (event.type === "text") {
        text += event.delta;
        onContent(text);
      }

      if (event.type === "failed") {
        throw new Error(event.message);
      }

      if (event.type === "approval-required") {
        throw new Error(
          "This agent requested an approval that the desktop cannot answer. Run it in its own CLI to approve this action.",
        );
      }

      if (event.type === "finished") {
        if (event.reason !== "complete") {
          throw new Error(`The runtime ended the run (${event.reason}).`);
        }

        completed = true;
        break;
      }
    }

    if (!completed) {
      throw new Error("The runtime disconnected before completing its reply.");
    }

    return text;
  } finally {
    if (!completed) {
      cancel();
    }

    signal.removeEventListener("abort", cancel);
  }
}
