import { createKnowledgeSyncSchema, type CreateKnowledgeSync } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export interface KnowledgeRepositoryOption {
  key: string;
  repo: string;
  installationId: number;
}

export function useKnowledgeConnectionForm(options: {
  projectId?: string;
  repositories: KnowledgeRepositoryOption[];
  onCreate: (input: CreateKnowledgeSync) => Promise<void>;
  onCreated: () => void;
}) {
  const [selection, setSelection] = useState("");
  const [branch, setBranch] = useState("main");
  const [path, setPath] = useState("docs");
  const [error, setError] = useState<string | null>(null);
  const repository = options.repositories.find((item) => item.key === selection);
  const submit = async () => {
    const parsed = createKnowledgeSyncSchema.safeParse({
      projectId: options.projectId,
      repository: repository?.repo,
      installationId: repository?.installationId,
      branch,
      path,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the repository settings");

      return;
    }

    try {
      await options.onCreate(parsed.data);
      setError(null);
      options.onCreated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to start sync");
    }
  };

  return { selection, setSelection, branch, setBranch, path, setPath, repository, error, submit };
}
