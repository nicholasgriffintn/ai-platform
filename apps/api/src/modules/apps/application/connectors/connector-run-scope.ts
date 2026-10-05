export interface ConnectorRunScope {
  completionId: string;
  conversationId: string | null;
  recipeId?: string;
  installationId?: string;
  projectId?: string;
  teammateContextId?: string;
}
