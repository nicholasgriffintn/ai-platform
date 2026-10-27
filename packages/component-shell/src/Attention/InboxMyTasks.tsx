import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  groupByPlace,
  PlaceHeading,
  ProjectGroupCard,
  WorkTaskRow,
  type PlacedWorkspaceGroup,
  type WorkPlaceNames,
} from "@ngriffin_uk/polychat-component-workspaces";
import { getProjectBasePath, getProjectTaskPath } from "@ngriffin_uk/polychat-library-react";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { ListTodo } from "lucide-react";

import { useWorkDirectory } from "../Work/useWorkDirectory.js";

function WorkspaceTasks({ group }: { group: PlacedWorkspaceGroup<ProjectTask, string> }) {
  const { directory } = useWorkDirectory(group.workspaceId);

  return (
    <div className="space-y-3">
      <PlaceHeading name={group.name} count={group.count} />
      {group.projects.map((project) => (
        <ProjectGroupCard
          key={project.projectId ?? "workspace"}
          name={project.name}
          count={project.items.length}
          href={project.projectId ? getProjectBasePath(group.workspaceId, project.projectId) : null}
        >
          {project.items.map((task) => (
            <WorkTaskRow
              key={task.id}
              task={task}
              directory={directory}
              href={getProjectTaskPath(task.workspaceId, task.projectId, task.id)}
            />
          ))}
        </ProjectGroupCard>
      ))}
    </div>
  );
}

export function InboxMyTasks({
  tasks,
  isLoading,
  names,
}: {
  tasks: readonly ProjectTask[];
  isLoading: boolean;
  names: WorkPlaceNames;
}) {
  if (isLoading && tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<ListTodo size={24} className="text-muted-foreground" />}
        title="Nothing on your plate"
        message="Tasks you own, and tasks teammates run on your behalf, show up here."
        className="min-h-[220px]"
      />
    );
  }

  return (
    <div className="space-y-8">
      {groupByPlace(
        tasks,
        (task) => ({ workspaceId: task.workspaceId, projectId: task.projectId }),
        names,
      ).map((group) => (
        <WorkspaceTasks key={group.workspaceId} group={group} />
      ))}
    </div>
  );
}
