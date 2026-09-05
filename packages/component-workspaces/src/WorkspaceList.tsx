export interface WorkspaceSummary {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  description?: string;
}
export function WorkspaceList({
  workspaces,
  activeWorkspaceId,
  onSelect,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId?: string;
  onSelect: (workspace: WorkspaceSummary) => void;
}) {
  return (
    <ul className="grid list-none gap-2 p-0">
      {workspaces.map((workspace) => (
        <li key={workspace.id}>
          <button
            type="button"
            className="grid w-full cursor-pointer rounded-lg border border-border bg-transparent p-3 text-left transition-colors hover:bg-surface-elevated aria-[current=page]:border-active-work"
            aria-current={workspace.id === activeWorkspaceId ? "page" : undefined}
            onClick={() => onSelect(workspace)}
          >
            <strong className="text-sm text-foreground">{workspace.name}</strong>
            <span className="text-sm text-muted-foreground">{workspace.description}</span>
            <small className="text-xs capitalize text-muted-foreground">{workspace.role}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}
