import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import {
  BrowserAuthenticationForm,
  ComputerObservationView,
} from "@ngriffin_uk/polychat-component-conversation";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useBrowserSession } from "@ngriffin_uk/polychat-library-react";
import {
  browserSessionViewDataSchema,
  type BrowserSessionViewData,
} from "@ngriffin_uk/polychat-schemas";

import { useBrowserSessionContinuation } from "./useBrowserSessionContinuation.js";

export function BrowserSessionView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const parsed = browserSessionViewDataSchema.safeParse(data);

  return parsed.success ? (
    <OwnedBrowserSessionView
      key={parsed.data.sessionId}
      request={parsed.data}
      onToolInteraction={onToolInteraction}
    />
  ) : null;
}

function OwnedBrowserSessionView({
  request,
  onToolInteraction,
}: {
  request: BrowserSessionViewData;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const browser = useBrowserSession(request.sessionId);
  const session = browser.error ? undefined : browser.data;
  const finished =
    browser.closed || ["completed", "failed", "cancelled"].includes(session?.status ?? "");
  const latest = session?.activity.find((item) => Boolean(item.screenshot));
  const { isReturning, returned, returnError, continueChat } = useBrowserSessionContinuation({
    request,
    onToolInteraction,
    status: session?.status,
    closed: browser.closed,
  });

  return (
    <section className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <p className="font-medium">
        Hosted browser ·{" "}
        {browser.closed ? "closed" : (session?.status.replaceAll("_", " ") ?? "connecting")}
      </p>
      {latest && !browser.closed && (
        <ComputerObservationView
          data={{
            screenshot: latest.screenshot,
            title: latest.title ?? "Browser activity",
            width: 1440,
            height: 900,
          }}
        />
      )}
      {session?.activity.at(-1)?.title && (
        <p className="text-muted-foreground">{session.activity.at(-1)?.title}</p>
      )}
      {!browser.closed &&
        session?.approvals.map((approval) => (
          <div
            key={approval.requestId}
            className="space-y-2 rounded-md border border-attention/45 p-3"
          >
            {approval.request.type === "browser_authentication" ? (
              <BrowserAuthenticationForm
                key={approval.requestId}
                approval={approval}
                disabled={browser.isSubmitting || Boolean(browser.error)}
                onRespond={(response) =>
                  browser.respond({ requestId: approval.requestId, response })
                }
              />
            ) : (
              <>
                <p className="font-medium">Allow access to {approval.request.origin}?</p>
                <p className="text-muted-foreground">{approval.request.reason}</p>
                <p className="text-xs text-muted-foreground">
                  The browser can act on this website for the requested task.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={browser.isSubmitting || Boolean(browser.error)}
                    onClick={() =>
                      void browser.respond({
                        requestId: approval.requestId,
                        response: { type: "browser_origin_access", decision: "approve" },
                      })
                    }
                  >
                    Allow website
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={browser.isSubmitting || Boolean(browser.error)}
                    onClick={() =>
                      void browser.respond({
                        requestId: approval.requestId,
                        response: { type: "browser_origin_access", decision: "deny" },
                      })
                    }
                  >
                    Deny
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      {session?.outputText && <p className="whitespace-pre-wrap">{session.outputText}</p>}
      {(browser.error || browser.actionError || session?.error || returnError) && (
        <p role="alert" className="text-destructive">
          {browser.actionError ??
            session?.error ??
            (returnError
              ? "The conversation could not be continued. Try again."
              : "Browser state could not be refreshed.")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {finished && request.humanInTheLoop && onToolInteraction && !returned && (
          <Button size="sm" isLoading={isReturning} onClick={() => void continueChat()}>
            Continue conversation
          </Button>
        )}
        {!browser.closed && !finished && (
          <Button
            size="sm"
            variant="outline"
            disabled={browser.isSubmitting}
            onClick={() => void browser.stop()}
          >
            Stop task
          </Button>
        )}
        {!browser.closed && (
          <Button
            size="sm"
            variant="outline"
            disabled={browser.isSubmitting}
            onClick={() => void browser.destroy()}
          >
            Close browser
          </Button>
        )}
        {!browser.closed && (
          <Button
            size="sm"
            variant="outline"
            disabled={browser.isSubmitting}
            onClick={() => void browser.refetch()}
          >
            Refresh
          </Button>
        )}
      </div>
    </section>
  );
}
