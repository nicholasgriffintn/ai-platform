import { getIcon } from "@ngriffin_uk/polychat-component-capabilities";
import { Link, Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  getAppPath,
  PERSONAL_SURFACE,
  useRemoteApps,
  useSetRemoteAppEnabled,
} from "@ngriffin_uk/polychat-library-react";
import type { RemoteApp } from "@ngriffin_uk/polychat-schemas";

function RemoteAppSummary({ app }: { app: RemoteApp }) {
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
        {getIcon(app.icon, app.theme, "h-5 w-5")}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{app.name}</span>
        <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
          {app.description}
        </span>
        {app.entry.kind === "remote" && (
          <span className="mt-2 block text-xs text-muted-foreground">{app.entry.server}</span>
        )}
      </span>
    </>
  );
}

export function RemoteAppsSection() {
  const { data: apps = [] } = useRemoteApps();
  const setEnabled = useSetRemoteAppEnabled();

  if (apps.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="remote-apps-heading" className="mt-10">
      <h2 id="remote-apps-heading" className="text-base font-semibold text-foreground">
        Apps from your MCP servers
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Views your connected servers offer as apps. They can read through your connection; anything
        that changes something is asked in a chat.
      </p>
      {setEnabled.error && (
        <p role="alert" className="mb-4 text-sm text-failure">
          {setEnabled.error.message}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <li
            key={app.id}
            className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            {app.enabled ? (
              <Link href={getAppPath(PERSONAL_SURFACE, app.id)} className="flex gap-3 no-underline">
                <RemoteAppSummary app={app} />
              </Link>
            ) : (
              <div className="flex gap-3 opacity-60">
                <RemoteAppSummary app={app} />
              </div>
            )}
            <Switch
              label={app.enabled ? "On" : "Off"}
              aria-label={`Show ${app.name}`}
              checked={app.enabled}
              disabled={setEnabled.isPending && setEnabled.variables?.appId === app.id}
              onChange={(event) =>
                setEnabled.mutate({ appId: app.id, enabled: event.target.checked })
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
