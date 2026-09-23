import { BackLink, ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useCapabilityCatalog,
  type AppProjectScope,
  type CapabilitySurface,
  getAppBackLink,
  getAppPath,
  getPluginsPath,
  isExperienceEnabled,
} from "@ngriffin_uk/polychat-library-react";
import { Puzzle } from "lucide-react";
import { useMemo } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { AppChromeProvider } from "./AppChrome.js";
import { AppRuntime } from "./AppRuntime.js";
import { AppSurface, AppSurfaceLoading, getAppSurfacePresentation } from "./AppSurface.js";

export function AppRoute({
  appId,
  project,
  subpath = "",
  surface,
  title: titleOverride,
}: {
  appId: string;
  project?: AppProjectScope;
  subpath?: string;
  surface: CapabilitySurface;
  title?: string;
}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const {
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useCapabilityCatalog(surface.projectId);
  const definition = catalog?.experiences.find((item) => item.id === appId);
  const title = titleOverride ?? definition?.name;
  const backLink = getAppBackLink(surface, appId, subpath, title);
  const basePath = getAppPath(surface, appId);
  const presentation = getAppSurfacePresentation(appId, subpath);
  const needsSignIn = !isAuthenticationLoading && !isAuthenticated;
  const isLoading = isCatalogLoading || isAuthenticationLoading || Boolean(project?.isLoading);
  const pageError = project?.error ?? catalogError;
  const isEnabled =
    !project || (definition ? isExperienceEnabled(definition, project.capabilities ?? []) : false);
  const chrome = useMemo(
    () => ({ backHref: backLink?.to, backLabel: backLink?.label }),
    [backLink?.to, backLink?.label],
  );
  const runtime = (
    <AppChromeProvider value={chrome}>
      <AppRuntime
        basePath={basePath}
        fallback={<AppSurfaceLoading presentation={presentation} />}
        projectId={surface.projectId}
        runtime={definition?.runtime ?? "notes"}
        subpath={subpath}
      />
    </AppChromeProvider>
  );

  return (
    <AppSurface presentation={presentation}>
      {presentation.layout === "contained" && (
        <>
          <PageShell.Header title={title ?? "App"} />
          {backLink && <BackLink href={backLink.to} label={backLink.label} />}
          {definition && (
            <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{definition.description}</p>
          )}
        </>
      )}

      {isLoading ? (
        <AppSurfaceLoading presentation={presentation} />
      ) : needsSignIn || isAuthenticationError(pageError) ? (
        <SignInEmptyState
          title="Sign in to open this app"
          message="This app keeps your work, so it needs an account."
          className="min-h-[300px]"
        />
      ) : pageError ? (
        <EmptyState title="App unavailable" message={pageError.message} />
      ) : !definition ? (
        <EmptyState title="App not found" message="This app does not exist." />
      ) : !isEnabled ? (
        <EmptyState
          icon={<Puzzle size={24} className="text-muted-foreground" />}
          title="App not enabled"
          message={`Add ${title} to the project before opening it.`}
          action={
            <ButtonLink variant="primary" href={getPluginsPath(surface)}>
              Open plugins
            </ButtonLink>
          }
        />
      ) : (
        runtime
      )}
    </AppSurface>
  );
}
