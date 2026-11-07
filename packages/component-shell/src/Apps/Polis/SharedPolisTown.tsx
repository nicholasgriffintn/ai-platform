import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { polisService } from "@ngriffin_uk/polychat-library-client";
import type { PolisRecording } from "@ngriffin_uk/polychat-schemas";
import { lazy, Suspense, useEffect, useState } from "react";

const PolisApp = lazy(async () => {
  const module = await import("./PolisApp.js");

  return { default: module.PolisApp };
});

type SharedState =
  | { status: "loading" }
  | { status: "ready"; recording: PolisRecording }
  | { status: "missing"; message: string };

export function SharedPolisTown({ token }: { token: string }) {
  const [state, setState] = useState<SharedState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    polisService
      .shared(token)
      .then((recording) => {
        if (!cancelled) {
          setState({ status: "ready", recording });
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setState({
            status: "missing",
            message: caught instanceof Error ? caught.message : "That town could not be opened",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "missing") {
    return <PageStatus title="No such town" message={state.message} />;
  }

  if (state.status === "loading") {
    return <PageStatus title="Opening the town" message="Fetching its history…" />;
  }

  return (
    <Suspense fallback={<PageStatus title="Opening the town" message="Building the map…" />}>
      <PolisApp recording={state.recording} />
    </Suspense>
  );
}
