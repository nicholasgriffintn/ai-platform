import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "~/components/ui";
import { useMemories } from "~/hooks/useMemory";

interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated: () => void;
}

export function CreateGroupModal({
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const { createGroup, isCreatingGroup } = useMemories();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    createGroup({
      title: title.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
    });

    onGroupCreated();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
            Create Memory Group
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
            >
              Group Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter group title"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this group is for (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
            >
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            >
              <option value="">Select a category</option>
              <option value="fact">Facts</option>
              <option value="preference">Preferences</option>
              <option value="schedule">Schedule</option>
              <option value="general">General</option>
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Categorize your memories for better organization
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreatingGroup} className="flex-1">
              {isCreatingGroup ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
