import {
  createProjectFlowFromWorkflow,
  createSuggestedProjectFlow,
  projectFlowSchema,
  type ProjectFlow,
  type ProjectFlowNode,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { type FormEvent, useRef, useState } from "react";

import { initialFlowDraft, newFlowNode } from "./draft";

export function useFlowEditor({
  open,
  flow,
  onSave,
}: {
  open: boolean;
  flow: ProjectFlow | null;
  onSave: (flow: ProjectFlow) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => initialFlowDraft(flow));
  const [previousOpen, setPreviousOpen] = useState(open);
  const [workflow, setWorkflow] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (open) {
      setDraft(initialFlowDraft(flow));
      setWorkflow("");
      setError(null);
    }
  }

  const validation = projectFlowSchema.safeParse(draft);
  const replaceNode = (node: ProjectFlowNode) =>
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((item) => (item.id === node.id ? node : item)),
    }));
  const addNode = (type: ProjectFlowNode["type"]) =>
    setDraft((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        newFlowNode(
          type,
          current.nodes.find((node) => node.type === "end")?.id ?? current.entryNodeId,
        ),
      ],
    }));
  const removeNode = (id: string) =>
    setDraft((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id) }));
  const applyWorkflow = (slug: string) => {
    setWorkflow(slug);
    const template =
      slug === "__suggested" ? createSuggestedProjectFlow() : createProjectFlowFromWorkflow(slug);

    if (template) {
      setDraft(template);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.success || pending.current) {
      return;
    }

    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(validation.data);
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to save this flow"));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return {
    draft,
    setDraft,
    workflow,
    applyWorkflow,
    replaceNode,
    addNode,
    removeNode,
    submit,
    saving,
    error,
    validation,
  };
}
