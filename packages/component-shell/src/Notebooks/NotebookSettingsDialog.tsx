import {
  FormDialog,
  FormInput,
  FormRadioGroup,
  FormTextarea,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import type { useNotebookActions } from "@ngriffin_uk/polychat-library-react";
import type {
  NotebookChatStyle,
  NotebookDetail,
  NotebookResponseLength,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

const STYLE_OPTIONS = [
  {
    value: "default",
    label: "Default",
    description: "A research partner for questions and brainstorming.",
  },
  {
    value: "learning_guide",
    label: "Learning guide",
    description: "Teaches step by step and checks what has sunk in.",
  },
  { value: "custom", label: "Custom", description: "A role or style you describe." },
] as const satisfies readonly { value: NotebookChatStyle; label: string; description: string }[];

const LENGTH_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "longer", label: "Longer" },
  { value: "shorter", label: "Shorter" },
] as const satisfies readonly { value: NotebookResponseLength; label: string }[];

export function NotebookSettingsDialog({
  open,
  onOpenChange,
  notebook,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebook: NotebookDetail;
  actions: ReturnType<typeof useNotebookActions>;
}) {
  const [name, setName] = useState(notebook.name);
  const [style, setStyle] = useState(notebook.settings.style);
  const [persona, setPersona] = useState(notebook.settings.persona);
  const [responseLength, setResponseLength] = useState(notebook.settings.responseLength);
  const [sourcesOnly, setSourcesOnly] = useState(notebook.settings.sourcesOnly);
  const [instructions, setInstructions] = useState(notebook.instructions);

  const save = async () => {
    try {
      await actions.update.mutateAsync({
        name: name.trim(),
        instructions,
        settings: { style, persona, responseLength, sourcesOnly },
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Those settings did not save"));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Notebook settings"
      description="How every chat in this notebook answers."
      submitText="Save"
      onSubmit={save}
      isLoading={actions.update.isPending}
      submitDisabled={!name.trim() || (style === "custom" && !persona.trim())}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <FormInput
          label="Name"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          fullWidth
        />
        <FormRadioGroup
          legend="Conversational style"
          value={style}
          options={STYLE_OPTIONS}
          onValueChange={setStyle}
        />
        {style === "custom" ? (
          <FormTextarea
            label="Who should it be?"
            description="For example, a doctoral supervisor who challenges every assumption."
            rows={3}
            maxLength={2000}
            value={persona}
            onChange={(event) => setPersona(event.target.value)}
          />
        ) : null}
        <FormRadioGroup
          legend="Response length"
          value={responseLength}
          options={LENGTH_OPTIONS}
          onValueChange={setResponseLength}
        />
        <Switch
          label="Answer from sources only"
          description="Keeps web search out of it. Turn off to let chats look further afield."
          checked={sourcesOnly}
          onChange={(event) => setSourcesOnly(event.target.checked)}
        />
        <FormTextarea
          label="Standing instructions"
          description="Anything every chat here should know or do."
          rows={4}
          maxLength={10000}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}
