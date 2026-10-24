import { FormSelect, type FormSelectOption, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  MAX_TRANSCRIPTION_VOCABULARY_TERMS,
  SPEECH_PROVIDER_VOICES,
  SPEECH_PROVIDERS,
  type SpeechModelOption,
} from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

import { SettingsSection } from "./SettingsSection";
import { SpeechVoiceLibrary, type SpeechVoiceLibraryActions } from "./SpeechVoiceLibrary";
import {
  getSpeechVoiceOptions,
  getTranscriptionModelOptions,
  transcriptionProviderOptions,
} from "./transcription-settings";
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
  onTranscriptionProviderChange: (value: string) => void;
  onSpeechProviderChange: (value: string) => void;
  speechModels: readonly SpeechModelOption[];
  speechVoiceLibrary?: SpeechVoiceLibraryActions;
}

function speechModelLabel(model: SpeechModelOption): string {
  return model.arenaScore ? `${model.name} · arena ${model.arenaScore}` : model.name;
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
  onTranscriptionProviderChange,
  onSpeechProviderChange,
  speechModels,
  speechVoiceLibrary,
}: AudioSettingsProps) {
  const savedVoices = formData.speech_voices ?? [];
  const speechProvider = formData.speech_provider ?? null;
  const isMistralSpeech = speechProvider === "mistral";
  const [automatic] = speechModels;
  const providerModels = speechModels.filter((model) => model.provider === speechProvider);
  const speechProviderOptions: FormSelectOption[] = [
    { value: "", label: automatic ? `Automatic - ${automatic.name}` : "Automatic" },
    ...SPEECH_PROVIDERS.filter(
      (provider) =>
        provider === speechProvider || speechModels.some((model) => model.provider === provider),
    ).map((provider) => ({ value: provider, label: SPEECH_PROVIDER_VOICES[provider].label })),
  ];

  return (
    <SettingsSection title="Audio">
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="transcription_provider">Transcription Provider</FieldLabel>
          <FieldDescription>
            Choose the provider for speech-to-text transcription used by Polychat.
          </FieldDescription>
          <FormSelect
            id="transcription_provider"
            name="transcription_provider"
            value={formData.transcription_provider}
            options={transcriptionProviderOptions.map((provider) => ({
              value: provider.id,
              label: provider.label,
            }))}
            onValueChange={onTranscriptionProviderChange}
          />
        </div>

        <div>
          <FieldLabel htmlFor="transcription_model">Transcription Model</FieldLabel>
          <FieldDescription>
            Select from the available models for the {formData.transcription_provider} provider.
          </FieldDescription>
          <FormSelect
            id="transcription_model"
            name="transcription_model"
            value={formData.transcription_model}
            options={getTranscriptionModelOptions(formData.transcription_provider).map((model) => ({
              value: model.id,
              label: model.label,
            }))}
            onValueChange={(value) => updateFormData({ transcription_model: value })}
          />
        </div>

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

        <div>
          <FieldLabel htmlFor="speech_provider">Speech Provider</FieldLabel>
          <FieldDescription>
            Automatic uses the best-rated voice your account can reach, so adding a provider key
            such as ElevenLabs upgrades read-aloud, podcasts and video narration.
          </FieldDescription>
          <FormSelect
            id="speech_provider"
            name="speech_provider"
            value={speechProvider ?? ""}
            options={speechProviderOptions}
            onValueChange={onSpeechProviderChange}
          />
        </div>

        {speechProvider && (
          <div>
            <FieldLabel htmlFor="speech_model">Speech Model</FieldLabel>
            <FieldDescription>
              Scores come from the Artificial Analysis text-to-speech arena.
            </FieldDescription>
            <FormSelect
              id="speech_model"
              name="speech_model"
              value={formData.speech_model ?? ""}
              options={[
                {
                  value: "",
                  label: providerModels[0]
                    ? `Best available - ${providerModels[0].name}`
                    : "Best available",
                },
                ...providerModels.map((model) => ({
                  value: model.id,
                  label: speechModelLabel(model),
                })),
              ]}
              onValueChange={(value) => updateFormData({ speech_model: value || null })}
            />
          </div>
        )}

        {speechProvider && (
          <div>
            <FieldLabel htmlFor="speech_voice">Voice</FieldLabel>
            <FieldDescription>Used when Polychat reads to you or narrates.</FieldDescription>
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
