import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SignInEmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink, Link2, Trash2 } from "lucide-react";

import { SettingsSection } from "../SettingsSection";

export interface SandboxConnection {
  installationId: number;
  appId: string | number;
  updatedAt: string;
  repositories: string[];
  hasWebhookSecret?: boolean;
}

export interface SandboxConnectionListProps {
  connections: SandboxConnection[];
  isLoading?: boolean;
  requiresSignIn?: boolean;
  loadErrorMessage?: string;
  onSignIn: () => void;
  onDelete: (installationId: number) => void;
  deletingInstallationId?: number | null;
}

export function SandboxConnectionList({
  connections,
  isLoading = false,
  requiresSignIn = false,
  loadErrorMessage,
  onSignIn,
  onDelete,
  deletingInstallationId = null,
}: SandboxConnectionListProps) {
  return (
    <SettingsSection
      title="Repository connections"
      description={`${connections.length} installation${connections.length === 1 ? "" : "s"} connected.`}
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading connections...</div>
      ) : requiresSignIn ? (
        <SignInEmptyState
          title="Sign in to view sandbox connections"
          message="Sign in to manage the GitHub connections used by Sandbox."
          className="border-0 bg-transparent dark:bg-transparent"
          onSignIn={onSignIn}
        />
      ) : loadErrorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load connections</AlertTitle>
          <AlertDescription>{loadErrorMessage}</AlertDescription>
        </Alert>
      ) : connections.length === 0 ? (
        <EmptyState
          icon={<ExternalLink className="h-8 w-8 text-muted-foreground" />}
          title="No sandbox connections yet"
          message="Install the GitHub App or add a connection manually to start running sandbox tasks from chat."
          className="min-h-[260px]"
        />
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <div key={connection.installationId} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Installation {connection.installationId}
                  </p>
                  <p className="text-xs text-muted-foreground">App ID: {connection.appId}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatRelativeTime(connection.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => onDelete(connection.installationId)}
                  isLoading={deletingInstallationId === connection.installationId}
                >
                  Remove
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">
                  {connection.repositories.length || "Any"} repo
                  {connection.repositories.length === 1 ? "" : "s"}
                </Badge>
                {connection.hasWebhookSecret && <Badge variant="outline">Webhook enabled</Badge>}
                {connection.repositories.slice(0, 4).map((repo) => (
                  <Badge key={repo} variant="outline">
                    {repo}
                  </Badge>
                ))}
                {connection.repositories.length > 4 && (
                  <Badge variant="outline">+{connection.repositories.length - 4} more</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
