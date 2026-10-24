import {
  FormDialog,
  FormInput,
  FormSelect,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  notebookStudioRequestSchema,
  type NotebookStudioRequest,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { defaultStudioChoices, type StudioTile } from "./studio-kinds.js";

export function NotebookStudioDialog({
  tile,
  sourceCount,
  isStarting,
  onOpenChange,
  onStart,
}: {
  tile: StudioTile;
  sourceCount: number;
  isStarting: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (request: NotebookStudioRequest) => Promise<void>;
}) {
  const [choices, setChoices] = useState(() => defaultStudioChoices(tile));
  const [focus, setFocus] = useState("");
  const [language, setLanguage] = useState("en");

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`Customise ${tile.label.toLowerCase()}`}
      description={`Made from ${sourceCount === 1 ? "1 source" : `${sourceCount} sources`}. ${tile.description}`}
      submitText="Generate"
      isLoading={isStarting}
      submitDisabled={sourceCount === 0 || language.trim().length < 2}
      onSubmit={() =>
        onStart(
          notebookStudioRequestSchema.parse({
            kind: tile.kind,
            ...choices,
            language: language.trim(),
            ...(focus.trim() ? { focus: focus.trim() } : {}),
          }),
        )
      }
    >
      <div className="flex flex-col gap-4">
        {tile.choices.map((choice) => (
          <FormSelect
            key={choice.name}
            label={choice.label}
            options={choice.options}
            value={choices[choice.name]}
            onValueChange={(value) =>
              setChoices((current) => ({ ...current, [choice.name]: value }))
            }
            fullWidth
          />
        ))}
        <FormInput
          label="Language"
          description="A language code such as en, fr or ja."
          value={language}
          maxLength={10}
          onChange={(event) => setLanguage(event.target.value)}
          fullWidth
        />
        <FormTextarea
          label="What should it focus on?"
          placeholder="A topic, an audience, or anything to leave out"
          rows={3}
          maxLength={2000}
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}
