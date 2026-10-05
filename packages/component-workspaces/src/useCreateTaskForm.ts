import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { type FormEvent, useRef, useState } from "react";

import type { CreateTaskDialogProps } from "./CreateTaskDialog";
import { createTaskDraft, taskDraftInput, type TaskDraft } from "./utils/task-draft";

export function useCreateTaskForm({
  flow,
  onSubmit,
  isSubmitting,
}: Pick<CreateTaskDialogProps, "flow" | "onSubmit" | "isSubmitting">) {
  const [draft, setDraft] = useState(() => createTaskDraft(flow));
  const nodeId = flow?.nodes.some((node) => node.id === draft.nodeId)
    ? draft.nodeId
    : (flow?.entryNodeId ?? "");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const submitting = useRef(false);
  const nextCriterionId = useRef(2);
  const updateDraft = (patch: Partial<TaskDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const addCriterion = () => {
    const id = nextCriterionId.current++;

    setDraft((current) => ({ ...current, criteria: [...current.criteria, { id, text: "" }] }));
  };

  const updateCriterion = (id: number, text: string) =>
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((criterion) =>
        criterion.id === id ? { id, text } : criterion,
      ),
    }));
  const removeCriterion = (id: number) =>
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.filter((criterion) => criterion.id !== id),
    }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || isSubmitting || !draft.objective.trim()) {
      return;
    }

    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const intent =
      submitter instanceof HTMLButtonElement && submitter.value === "run" ? "run" : "save";

    submitting.current = true;
    setIsSaving(true);
    setSubmissionError(null);
    try {
      await onSubmit(taskDraftInput({ ...draft, nodeId }), intent);
      setDraft(createTaskDraft(flow));
    } catch (error) {
      setSubmissionError(getErrorMessage(error, "Unable to add this task"));
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  };

  return {
    draft: { ...draft, nodeId },
    updateDraft,
    addCriterion,
    updateCriterion,
    removeCriterion,
    handleSubmit,
    submissionError,
    isPending: isSaving || isSubmitting,
  };
}
