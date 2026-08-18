import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  SignInEmptyState,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { Sparkles, Trash2 } from "lucide-react";

export interface StrudelPatternFormProps {
  name: string;
  onNameChange: (value: string) => void;
  tagsInput: string;
  onTagsInputChange: (value: string) => void;
  tags: string[];
  description: string;
  onDescriptionChange: (value: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  canSave: boolean;
  onSave: () => void;
  isSaving?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  requiresSignIn?: boolean;
  onSignIn: () => void;
  errorMessage?: string;
}

export function StrudelPatternForm({
  name,
  onNameChange,
  tagsInput,
  onTagsInputChange,
  tags,
  description,
  onDescriptionChange,
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating = false,
  canSave,
  onSave,
  isSaving = false,
  canDelete = false,
  onDelete,
  isDeleting = false,
  requiresSignIn = false,
  onSignIn,
  errorMessage,
}: StrudelPatternFormProps) {
  return (
    <Card className="h-fit gap-5 p-5 shadow-none">
      <div className="space-y-2">
        <Label htmlFor="pattern-name">Name</Label>
        <Input
          id="pattern-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pattern-tags">Tags (optional)</Label>
        <Input
          id="pattern-tags"
          value={tagsInput}
          onChange={(event) => onTagsInputChange(event.target.value)}
          placeholder="drums, ambient, halftime"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="pattern-description">Description</Label>
        <Textarea
          id="pattern-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pattern-prompt">Generate from a prompt</Label>
        <Textarea
          id="pattern-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="A warm, slow lo-fi beat"
        />
        <Button
          variant="secondary"
          fullWidth
          icon={<Sparkles size={16} />}
          disabled={!prompt.trim()}
          isLoading={isGenerating}
          onClick={onGenerate}
        >
          Generate pattern
        </Button>
      </div>
      {requiresSignIn ? (
        <SignInEmptyState
          title="Sign in to save patterns"
          message="Sign in to save and update patterns."
          onSignIn={onSignIn}
        />
      ) : (
        errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={!canSave}
          isLoading={isSaving}
          onClick={onSave}
        >
          Save
        </Button>
        {canDelete && (
          <Button
            variant="destructive"
            aria-label="Delete pattern"
            icon={<Trash2 size={16} />}
            isLoading={isDeleting}
            onClick={onDelete}
          />
        )}
      </div>
    </Card>
  );
}
