import { BackLink, ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useCapabilityCatalog,
  useRemoteApps,
  type AppProjectScope,
  type CapabilitySurface,
  getAppBackLink,
  getAppPath,
  getPluginsPath,
  isExperienceEnabled,
  resolveAppAddress,
} from "@ngriffin_uk/polychat-library-react";
import { Puzzle, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Navigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { AppChromeProvider } from "./AppChrome.js";
import { AppRuntime } from "./AppRuntime.js";
import { AppSurface, AppSurfaceLoading, CONTAINED_APP_PRESENTATION } from "./AppSurface.js";

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
  const isPro = useChatStore((state) => state.isPro);
  const {
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useCapabilityCatalog(surface.projectId);
  const path = [appId, subpath].filter(Boolean).join("/");
  const bundledAddress = catalog ? resolveAppAddress(catalog.experiences, path) : undefined;
  const looksUpRemoteApp = !project && Boolean(catalog) && !bundledAddress;
  const {
    data: remoteApps,
    isLoading: isRemoteAppLoading,
    error: remoteAppError,
  } = useRemoteApps({ enabled: looksUpRemoteApp });
  const address =
    bundledAddress ??
    (looksUpRemoteApp && remoteApps ? resolveAppAddress(remoteApps, path) : undefined);
  const definition = address?.app;
  const appSubpath = address?.subpath ?? subpath;
  const appSlug = definition?.slug ?? appId;
  const title = titleOverride ?? definition?.name;
  const backLink =
    definition || !isCatalogLoading ? getAppBackLink(surface, appSlug, appSubpath, title) : null;
  const basePath = getAppPath(surface, appSlug);
  const presentation = definition?.surface ?? CONTAINED_APP_PRESENTATION;
  const needsSignIn = !isAuthenticationLoading && !isAuthenticated;
  const needsPro = !isAuthenticationLoading && isAuthenticated && !isPro;
  const isLoading =
    isCatalogLoading ||
    isAuthenticationLoading ||
    Boolean(project?.isLoading) ||
    (looksUpRemoteApp && isRemoteAppLoading);
  const pageError = project?.error ?? catalogError ?? (looksUpRemoteApp ? remoteAppError : null);
  const isEnabled = project
    ? definition
      ? isExperienceEnabled(definition, project.capabilities ?? [])
      : false
    : definition?.enabled !== false;
  const chrome = useMemo(
    () => ({ backHref: backLink?.to, backLabel: backLink?.label }),
    [backLink?.to, backLink?.label],
  );
  const runtime = (
    <AppChromeProvider value={chrome}>
      <AppRuntime
        basePath={basePath}
        fallback={<AppSurfaceLoading presentation={presentation} />}
        app={definition}
        projectId={surface.projectId}
        subpath={appSubpath}
      />
    </AppChromeProvider>
  );

  const unavailable =
    needsSignIn || isAuthenticationError(pageError) ? (
      <SignInEmptyState
        title="Sign in to open this app"
        message="This app keeps your work, so it needs an account."
        className="min-h-[300px]"
      />
    ) : needsPro ? (
      <EmptyState
        icon={<Sparkles size={24} className="text-muted-foreground" />}
        title="Apps are part of Pro"
        message={`Upgrade to Pro to open ${title ?? "this app"} and every other app.`}
        action={
          <ButtonLink variant="primary" href="/pricing">
            See plans
          </ButtonLink>
        }
      />
    ) : pageError ? (
      <EmptyState title="App unavailable" message={pageError.message} />
    ) : !definition ? (
      <EmptyState title="App not found" message="This app does not exist." />
    ) : !isEnabled ? (
      <EmptyState
        icon={<Puzzle size={24} className="text-muted-foreground" />}
        title={project ? "App not enabled" : "App turned off"}
        message={
          project
            ? `Add ${title} to the project before opening it.`
            : `Turn ${title} on in Plugins to open it.`
        }
        action={
          <ButtonLink variant="primary" href={getPluginsPath(surface)}>
            Open plugins
          </ButtonLink>
        }
      />
    ) : null;
  const surfacePresentation = !isLoading && unavailable ? CONTAINED_APP_PRESENTATION : presentation;

  if (definition && address?.isLegacy) {
    return <Navigate replace to={getAppPath(surface, definition.slug, address.subpath)} />;
  }

  return (
    <AppSurface presentation={surfacePresentation}>
      {surfacePresentation.layout === "contained" && (
        <>
          <PageShell.Header title={title ?? "App"} />
          {backLink && <BackLink href={backLink.to} label={backLink.label} />}
          {definition && (
            <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{definition.description}</p>
          )}
        </>
      )}

      {isLoading ? <AppSurfaceLoading presentation={presentation} /> : (unavailable ?? runtime)}
    </AppSurface>
  );
}
