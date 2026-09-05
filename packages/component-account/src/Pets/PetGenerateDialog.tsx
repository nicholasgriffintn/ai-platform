import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { PET_DESCRIPTION_MAX_LENGTH, PET_PROMPT_MAX_LENGTH } from "@ngriffin_uk/polychat-schemas";
import { Loader2, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

const EMPTY_SUGGESTIONS: readonly string[] = [];

export interface PetGenerateSubmission {
  name: string;
  description: string;
  prompt: string;
}

export interface PetGenerateDialogProps {
  open: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  preview: ReactNode;
  hasPreview: boolean;
  error?: string | null;
  suggestions?: readonly string[];
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string) => void;
  onSave: (submission: PetGenerateSubmission) => void;
}

export function PetGenerateDialog({
  open,
  isGenerating,
  isSaving,
  preview,
  hasPreview,
  error = null,
  suggestions = EMPTY_SUGGESTIONS,
  onOpenChange,
  onGenerate,
  onSave,
}: PetGenerateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setPrompt("");
    }
  }, [open]);

  const isBusy = isGenerating || isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a pet with Polychat</DialogTitle>
          <DialogDescription>
            Describe what you want and Polychat will draw it, then animate it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label
              htmlFor="pet_generate_name"
              className="block text-sm font-medium text-foreground"
            >
              Pet name
            </label>
            <FormInput
              id="pet_generate_name"
              name="pet_generate_name"
              value={name}
              placeholder="Name your pet"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="pet_generate_prompt"
              className="block text-sm font-medium text-foreground"
            >
              What should it be?
            </label>
            <Textarea
              id="pet_generate_prompt"
              name="pet_generate_prompt"
              value={prompt}
              rows={3}
              maxLength={PET_PROMPT_MAX_LENGTH}
              placeholder="A cosy red panda in a knitted jumper"
              onChange={(event) => setPrompt(event.target.value)}
            />
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => setPrompt(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="pet_generate_description"
              className="block text-sm font-medium text-foreground"
            >
              Pet description (optional)
            </label>
            <Textarea
              id="pet_generate_description"
              name="pet_generate_description"
              value={description}
              rows={2}
              maxLength={PET_DESCRIPTION_MAX_LENGTH}
              placeholder="Describe your pet"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border-strong p-3">
            {isGenerating ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Drawing your pet
              </span>
            ) : hasPreview ? (
              preview
            ) : (
              <span className="text-sm text-muted-foreground">
                A preview appears here before anything is saved.
              </span>
            )}
          </div>

          {error ? <p className="text-sm text-failure">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={isBusy || prompt.trim().length === 0}
            onClick={() => onGenerate(prompt.trim())}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {hasPreview ? "Draw again" : "Draw it"}
          </Button>
          <Button
            disabled={isBusy || !hasPreview || name.trim().length === 0}
            onClick={() =>
              onSave({ name: name.trim(), description: description.trim(), prompt: prompt.trim() })
            }
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Keep this pet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
