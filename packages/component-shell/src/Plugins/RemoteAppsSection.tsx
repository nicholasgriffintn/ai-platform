import { getIcon } from "@ngriffin_uk/polychat-component-capabilities";
import { Link } from "@ngriffin_uk/polychat-component-ui";
import { getAppPath, PERSONAL_SURFACE, useRemoteApps } from "@ngriffin_uk/polychat-library-react";

export function RemoteAppsSection() {
  const { data: apps = [] } = useRemoteApps();

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
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <li key={app.id}>
            <Link
              href={getAppPath(PERSONAL_SURFACE, app.id)}
              className="flex h-full gap-3 rounded-xl border border-border bg-surface p-4 no-underline hover:bg-surface-elevated"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
                {getIcon(app.icon, app.theme, "h-5 w-5")}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{app.name}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                  {app.description}
                </span>
                {app.entry.kind === "remote" && (
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {app.entry.server}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
