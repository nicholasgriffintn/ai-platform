import { FormSelect, type FormSelectOption, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  MAX_TRANSCRIPTION_VOCABULARY_TERMS,
  type SpeechModelOption,
} from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

import { SettingsSection } from "./SettingsSection";
import { getSpeechVoiceOptions } from "./speech-voice-options";
import { SpeechVoiceLibrary, type SpeechVoiceLibraryActions } from "./SpeechVoiceLibrary";
import type { UserSettingsFormData } from "./user-settings";

const SPEECH_EXPRESSIVENESS_OPTIONS: FormSelectOption[] = [
  { value: "", label: "Default" },
  { value: "1", label: "Faithful to the voice" },
  { value: "2", label: "Lively" },
  { value: "3", label: "Expressive" },
  { value: "5", label: "Full theatre" },
];

interface AudioSettingsProps {
  formData: UserSettingsFormData;
  updateFormData: (patch: Partial<UserSettingsFormData>) => void;
  speechModels: readonly SpeechModelOption[];
  speechVoiceLibrary?: SpeechVoiceLibraryActions;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

function FieldDescription({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-muted-foreground">{children}</p>;
}

export function AudioSettings({
  formData,
  updateFormData,
  speechModels,
  speechVoiceLibrary,
}: AudioSettingsProps) {
  const savedVoices = formData.speech_voices ?? [];
  const [activeVoiceModel] = speechModels;
  const speechProvider = activeVoiceModel?.provider ?? null;
  const isMistralSpeech = speechProvider === "mistral";

  return (
    <SettingsSection title="Audio">
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="transcription_vocabulary">Custom vocabulary</FieldLabel>
          <FieldDescription>
            Names, acronyms and jargon to listen out for, one per line. You can also describe what
            you usually talk about. Mistral transcription and live sessions use these, up to{" "}
            {MAX_TRANSCRIPTION_VOCABULARY_TERMS} lines.
          </FieldDescription>
          <Textarea
            id="transcription_vocabulary"
            name="transcription_vocabulary"
            value={(formData.transcription_vocabulary ?? []).join("\n")}
            onChange={(event) =>
              updateFormData({ transcription_vocabulary: event.target.value.split("\n") })
            }
            placeholder={"Polychat\nVoxtral\nWeekly planning calls with the Lisbon team"}
            rows={4}
          />
        </div>

        {speechProvider && (
          <div>
            <FieldLabel htmlFor="speech_voice">Voice</FieldLabel>
            <FieldDescription>
              Used when Polychat reads to you or narrates with {activeVoiceModel?.name}, the voice
              model from your model choices. Change that model under Profile, Model choices.
            </FieldDescription>
            <FormSelect
              id="speech_voice"
              name="speech_voice"
              value={formData.speech_voice ?? ""}
              options={[
                { value: "", label: "Default voice" },
                ...getSpeechVoiceOptions(speechProvider, savedVoices).map((voice) => ({
                  value: voice.id,
                  label: voice.label,
                })),
              ]}
              onValueChange={(value) => updateFormData({ speech_voice: value || null })}
            />
          </div>
        )}

        {isMistralSpeech && (
          <div>
            <FieldLabel htmlFor="speech_expressiveness">Expressiveness</FieldLabel>
            <FieldDescription>
              How much feeling Mistral puts into a read. Higher settings perform more and sound a
              little less like the original voice.
            </FieldDescription>
            <FormSelect
              id="speech_expressiveness"
              name="speech_expressiveness"
              value={formData.speech_expressiveness ? String(formData.speech_expressiveness) : ""}
              options={SPEECH_EXPRESSIVENESS_OPTIONS}
              onValueChange={(value) =>
                updateFormData({ speech_expressiveness: value ? Number(value) : null })
              }
            />
          </div>
        )}

        {isMistralSpeech && speechVoiceLibrary && (
          <SpeechVoiceLibrary voices={savedVoices} {...speechVoiceLibrary} />
        )}
      </div>
    </SettingsSection>
  );
}
