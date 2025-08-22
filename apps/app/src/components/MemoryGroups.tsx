import { Folder, Trash2 } from "lucide-react";

import type { MemoryGroup } from "~/types/chat";

interface MemoryGroupsProps {
  groups: MemoryGroup[];
  selectedGroup: string | null;
  onGroupSelect: (groupId: string | null) => void;
  onDeleteGroup: (groupId: string) => void;
}

export function MemoryGroups({
  groups,
  selectedGroup,
  onGroupSelect,
  onDeleteGroup,
}: MemoryGroupsProps) {
  const handleDeleteGroup = async (groupId: string, groupTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the group "${groupTitle}"? This will not delete the memories, just remove them from the group.`,
      )
    ) {
      return;
    }

    onDeleteGroup(groupId);
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case "fact":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "preference":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "schedule":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-md font-medium text-zinc-800 dark:text-zinc-100">
          Memory Groups
        </h2>
      </div>

      <div className="space-y-1">
        <button
          onClick={() => onGroupSelect(null)}
          className={`w-full text-left p-2 rounded-md border transition-colors ${
            selectedGroup === null
              ? "bg-zinc-100 border-zinc-300 dark:bg-zinc-700 dark:border-zinc-600"
              : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
          }`}
        >
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                All Memories
              </div>
            </div>
          </div>
        </button>

        {groups.map((group) => (
          <div key={group.id} className="relative">
            <button
              onClick={() => onGroupSelect(group.id)}
              className={`w-full text-left p-2 rounded-md border transition-colors ${
                selectedGroup === group.id
                  ? "bg-zinc-100 border-zinc-300 dark:bg-zinc-700 dark:border-zinc-600"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                <div className="flex-1 min-w-0 pr-6">
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                    {group.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {group.member_count} memories
                    </span>
                    {group.category && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getCategoryColor(group.category)}`}
                      >
                        {group.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleDeleteGroup(group.id, group.title)}
              className="absolute top-1 right-1 p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete group"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-6">
          <Folder className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
          <p className="text-zinc-600 dark:text-zinc-400 text-xs">
            No memory groups yet. Create your first group to start organizing
            your memories.
          </p>
        </div>
      )}
    </div>
  );
}
