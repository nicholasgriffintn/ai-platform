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
            className="grid w-full cursor-pointer rounded-lg border border-zinc-200 bg-transparent p-3 text-left transition-colors hover:bg-zinc-50 aria-[current=page]:border-blue-500 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-current={workspace.id === activeWorkspaceId ? "page" : undefined}
            onClick={() => onSelect(workspace)}
          >
            <strong className="text-sm text-zinc-950 dark:text-zinc-100">{workspace.name}</strong>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {workspace.description}
            </span>
            <small className="text-xs capitalize text-zinc-500">{workspace.role}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}
