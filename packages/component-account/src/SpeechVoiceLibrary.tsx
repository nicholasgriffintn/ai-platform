import { Button, FormCheckbox, FormInput } from "@ngriffin_uk/polychat-component-ui";
import {
  MAX_SPEECH_VOICE_SAMPLE_BYTES,
  SPEECH_VOICE_SAMPLE_TYPES,
  type SavedSpeechVoice,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export interface SpeechVoiceLibraryActions {
  isCreating: boolean;
  isDeleting: boolean;
  onCreate: (voice: { name: string; sample: File; consent: true }) => Promise<unknown>;
  onDelete: (voiceId: string) => Promise<unknown>;
}

interface SpeechVoiceLibraryProps extends SpeechVoiceLibraryActions {
  voices: readonly SavedSpeechVoice[];
}

export function SpeechVoiceLibrary({
  voices,
  isCreating,
  isDeleting,
  onCreate,
  onDelete,
}: SpeechVoiceLibraryProps) {
  const [name, setName] = useState("");
  const [sample, setSample] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const sampleProblem =
    sample && sample.size > MAX_SPEECH_VOICE_SAMPLE_BYTES ? "Keep the sample under 20 MB." : "";
  const canSave = Boolean(name.trim() && sample && consent && !sampleProblem && !isCreating);

  const handleSave = async () => {
    if (!sample || !consent) {
      return;
    }

    setError("");

    try {
      await onCreate({ name: name.trim(), sample, consent: true });
      setName("");
      setSample(null);
      setConsent(false);
      setFileInputKey((key) => key + 1);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "The voice could not be saved"));
    }
  };

  const handleDelete = async (voiceId: string) => {
    setError("");

    try {
      await onDelete(voiceId);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "The voice could not be deleted"));
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Your voices</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clean MP3 or WAV of one person speaking and Mistral will learn to sound like
          them. Longer samples sound closer. Saved voices appear in the voice list above and only
          you can use them.
        </p>
      </div>

      {voices.length > 0 && (
        <ul className="divide-y divide-border">
          {voices.map((voice) => (
            <li key={voice.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">{voice.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                aria-label={`Delete ${voice.name}`}
                onClick={() => void handleDelete(voice.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormInput
          id="speech_voice_name"
          label="Voice name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Me, but well rested"
        />
        <FormInput
          key={fileInputKey}
          id="speech_voice_sample"
          label="Voice sample"
          type="file"
          accept={SPEECH_VOICE_SAMPLE_TYPES.join(",")}
          onChange={(event) => setSample(event.target.files?.[0] ?? null)}
        />
      </div>

      <FormCheckbox
        labelPosition="right"
        label="This is my voice, or I have permission to use it"
        checked={consent}
        onCheckedChange={setConsent}
      />

      {(sampleProblem || error) && (
        <p className="text-sm text-destructive" role="alert">
          {sampleProblem || error}
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!canSave}
        onClick={() => void handleSave()}
      >
        {isCreating ? "Saving voice..." : "Save voice"}
      </Button>
    </div>
  );
}
