import {
  Button,
  FormInput,
  FormSelect,
  SignInEmptyState,
  Switch,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { useAnalytics } from "@ngriffin_uk/polychat-library-react";
import { computeSiteSchema, modelTierSchema } from "@ngriffin_uk/polychat-schemas";
import { type FormEvent, type ReactNode, useState } from "react";

import { SettingsSection } from "./SettingsSection";
import {
  getSpeechModelOptions,
  getTranscriptionModelOptions,
  getSpeechProviderOption,
  getTranscriptionProviderOption,
  speechProviderOptions,
  transcriptionProviderOptions,
} from "./transcription-settings";
import {
  prepareUserSettingsPayload,
  resolveGuardrailsProviderId,
  type UserSettings,
} from "./user-settings";
import { useUserSettingsForm } from "./useUserSettingsForm";

export const USER_SETTINGS_FORM_ID = "user-settings-form";

export interface UserSettingsFormProps {
  userSettings: UserSettings | null;
  showSubmit?: boolean;
  afterPersonalisedResponses?: ReactNode;
  isAuthenticated: boolean;
  isPro?: boolean;
  isSaving?: boolean;
  onSignIn: () => void;
  onSave: (settings: Partial<UserSettings>) => Promise<void>;
  onSaveError?: (error: unknown) => void;
}

export function UserSettingsForm({
  userSettings,
  afterPersonalisedResponses,
  showSubmit = true,
  isAuthenticated,
  isSaving = false,
  onSignIn,
  onSave,
  onSaveError,
}: UserSettingsFormProps) {
  const analytics = useAnalytics();
  const { formData, updateFormData: updateDraft } = useUserSettingsForm(userSettings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const updateFormData = (patch: Partial<typeof formData>) => {
    setSaveSuccess(false);
    setSaveError("");
    updateDraft(patch);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    updateFormData({
      [name]: value,
    });

    analytics.track({
      name: "setting_field_edited",
      category: "ui_interaction",
      properties: {
        setting_name: name,
        has_value: value.trim().length > 0 ? "true" : "false",
      },
    });
  };

  const handleTranscriptionProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = getTranscriptionProviderOption(e.target.value).id;
    const [firstModelForProvider] = getTranscriptionModelOptions(newProvider);

    updateFormData({
      transcription_provider: newProvider,
      transcription_model: firstModelForProvider.id,
    });

    analytics.track({
      name: "transcription_provider_changed",
      category: "ui_interaction",
      properties: {
        provider: newProvider,
        auto_selected_model: firstModelForProvider.id,
      },
    });
  };

  const handleSpeechProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = getSpeechProviderOption(e.target.value).id;
    const [firstModelForProvider] = getSpeechModelOptions(newProvider);

    updateFormData({
      speech_provider: newProvider,
      speech_model: firstModelForProvider.id,
    });

    analytics.track({
      name: "speech_provider_changed",
      category: "ui_interaction",
      properties: {
        provider: newProvider,
        auto_selected_model: firstModelForProvider.id,
      },
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError("");

    analytics.track({
      name: "settings_save_attempt",
      category: "user_journey",
      properties: {
        setting_names: Object.keys(formData).join(","),
        guardrails_enabled: String(formData.guardrails_enabled),
        memories_enabled: String(formData.memories_save_enabled),
      },
    });

    try {
      const settingsPayload = prepareUserSettingsPayload(formData);

      await onSave(settingsPayload);
      setSaveSuccess(true);

      analytics.track({
        name: "settings_saved",
        category: "user_journey",
        properties: {
          setting_names: Object.keys(formData).join(","),
          guardrails_enabled: String(formData.guardrails_enabled),
          memories_enabled: String(formData.memories_save_enabled),
        },
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveError("Failed to save settings. Please try again.");

      onSaveError?.(error);
    }
  };

  if (!isAuthenticated) {
    return (
      <SignInEmptyState
        title="Sign in to customise your settings"
        message="Sign in to manage your Polychat preferences."
        className="bg-transparent px-0 py-6 dark:bg-transparent"
        onSignIn={onSignIn}
      />
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      id={USER_SETTINGS_FORM_ID}
      className="space-y-6"
    >
      <SettingsSection title="Personalised responses">
        <div className="space-y-4">
          <div>
            <label htmlFor="nickname" className="mb-1 block text-sm font-medium text-foreground">
              Nickname
            </label>
            <FormInput
              id="nickname"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              placeholder="Enter nickname"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="job_role" className="mb-1 block text-sm font-medium text-foreground">
              Job Role
            </label>
            <FormInput
              id="job_role"
              name="job_role"
              value={formData.job_role}
              onChange={handleChange}
              placeholder="Enter your job role"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="traits" className="mb-1 block text-sm font-medium text-foreground">
              Personal Traits
            </label>
            <Textarea
              id="traits"
              name="traits"
              value={formData.traits}
              onChange={handleChange}
              placeholder="Describe the traits or personality that the AI should have"
              rows={4}
            />
          </div>

          <div>
            <label htmlFor="preferences" className="mb-1 block text-sm font-medium text-foreground">
              Preferences
            </label>
            <Textarea
              id="preferences"
              name="preferences"
              value={formData.preferences}
              onChange={handleChange}
              placeholder="Your preferences for chat interactions"
              rows={4}
            />
          </div>
        </div>
      </SettingsSection>

      {afterPersonalisedResponses}

      <SettingsSection title="Chat defaults">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="default_model_id"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Default model
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this model for new conversations. Leave blank to use the selected model tier.
            </p>
            <FormInput
              id="default_model_id"
              name="default_model_id"
              value={formData.default_model_id}
              onChange={handleChange}
              placeholder="Optional model ID"
              className="w-full"
            />
          </div>

          <div>
            <label
              htmlFor="default_model_tier"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Default model tier
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Used for new conversations when no default model is set.
            </p>
            <FormSelect
              id="default_model_tier"
              name="default_model_tier"
              value={formData.default_model_tier}
              onChange={(event) => {
                const value = modelTierSchema.safeParse(event.target.value);
                updateFormData({
                  default_model_tier: value.success ? value.data : "",
                });
              }}
              className="w-full"
            >
              <option value="">Use the standard tier</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="ultra">Ultra</option>
            </FormSelect>
          </div>

          <div>
            <label
              htmlFor="default_compute_site"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Default compute site
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose where new conversations should run. If it is unavailable, Polychat explains the
              fallback and uses hosted compute.
            </p>
            <FormSelect
              id="default_compute_site"
              name="default_compute_site"
              value={formData.default_compute_site}
              onChange={(event) => {
                const value = computeSiteSchema.safeParse(event.target.value);
                updateFormData({
                  default_compute_site: value.success ? value.data : "",
                });
              }}
              className="w-full"
            >
              <option value="">Hosted compute</option>
              <option value="browser">This browser</option>
              <option value="device">This device</option>
              <option value="machine">Connected machine</option>
            </FormSelect>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Sandbox Worker">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="sandbox_model"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Default Sandbox Model
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Used for sandbox worker runs when no model override is provided in the request.
            </p>
            <FormInput
              id="sandbox_model"
              name="sandbox_model"
              value={formData.sandbox_model}
              onChange={(e) => {
                updateFormData({
                  sandbox_model: e.target.value,
                });

                analytics.track({
                  name: "sandbox_model_changed",
                  category: "ui_interaction",
                  properties: {
                    has_value: e.target.value.trim().length > 0 ? "true" : "false",
                  },
                });
              }}
              placeholder="e.g. mistral-large"
              className="w-full"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Guardrails">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="guardrails_enabled"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Guardrails Enabled
            </label>
            <Switch
              id="guardrails_enabled"
              checked={formData.guardrails_enabled}
              onChange={(e) =>
                updateFormData({
                  guardrails_enabled: e.target.checked,
                })
              }
            />
          </div>
          <div>
            <label
              htmlFor="guardrails_provider"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Guardrails Provider
            </label>
            <FormSelect
              id="guardrails_provider"
              name="guardrails_provider"
              value={formData.guardrails_provider}
              onChange={(e) =>
                updateFormData({
                  guardrails_provider: resolveGuardrailsProviderId(e.target.value),
                })
              }
            >
              <option value="llamaguard">LlamaGuard</option>
              <option value="bedrock">Bedrock</option>
              <option value="mistral">Mistral</option>
              <option value="shieldstral">Shieldstral (self-hosted)</option>
            </FormSelect>
          </div>
          {formData.guardrails_provider === "shieldstral" && (
            <p className="text-sm text-muted-foreground">
              Shieldstral uses the policy and inference endpoint configured by your Polychat
              operator.
            </p>
          )}
          {formData.guardrails_provider === "bedrock" && (
            <>
              <div>
                <label
                  htmlFor="bedrock_guardrail_id"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Guardrail ID
                </label>
                <FormInput
                  id="bedrock_guardrail_id"
                  name="bedrock_guardrail_id"
                  value={formData.bedrock_guardrail_id}
                  onChange={handleChange}
                  placeholder="Enter the guardrail ID"
                  className="w-full"
                />
              </div>
              <div>
                <label
                  htmlFor="bedrock_guardrail_version"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Guardrail Version
                </label>
                <FormInput
                  id="bedrock_guardrail_version"
                  name="bedrock_guardrail_version"
                  value={formData.bedrock_guardrail_version}
                  onChange={handleChange}
                  placeholder="Enter the guardrail version"
                  className="w-full"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Please note that you will also need to configure the api key for Bedrock in the
                providers section for this to work.
              </p>
            </>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Embeddings (RAG)">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="embedding_provider"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Embedding Provider
            </label>
            <FormSelect
              id="embedding_provider"
              name="embedding_provider"
              value={formData.embedding_provider}
              onChange={(e) =>
                updateFormData({
                  embedding_provider: e.target.value,
                })
              }
            >
              <option value="vectorize">Vectorize</option>
              <option value="s3vectors">S3 Vectors</option>
            </FormSelect>
          </div>
          {formData.embedding_provider === "s3vectors" && (
            <>
              <div>
                <label
                  htmlFor="s3vectors_bucket_name"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  S3 Vectors Bucket Name *
                </label>
                <FormInput
                  id="s3vectors_bucket_name"
                  name="s3vectors_bucket_name"
                  value={formData.s3vectors_bucket_name}
                  onChange={handleChange}
                  placeholder="Enter the S3 vectors bucket name"
                  className="w-full"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="s3vectors_index_name"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Index Name *
                </label>
                <FormInput
                  id="s3vectors_index_name"
                  name="s3vectors_index_name"
                  value={formData.s3vectors_index_name}
                  onChange={handleChange}
                  placeholder="Enter the index name"
                  className="w-full"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="s3vectors_region"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  AWS Region
                </label>
                <FormSelect
                  id="s3vectors_region"
                  name="s3vectors_region"
                  value={formData.s3vectors_region}
                  onChange={(e) =>
                    updateFormData({
                      s3vectors_region: e.target.value,
                    })
                  }
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">Europe (Ireland)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                </FormSelect>
              </div>
              <p className="text-sm text-muted-foreground">
                Please note that you will also need to configure the AWS credentials for S3 Vectors
                in the providers section for this to work.
              </p>
            </>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Memories">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="memory_provider"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Memory Provider
            </label>
            <FormSelect
              id="memory_provider"
              name="memory_provider"
              value={formData.memory_provider}
              onChange={(e) =>
                updateFormData({
                  memory_provider: e.target.value,
                })
              }
            >
              <option value="built-in">Built-in</option>
              <option value="documents">Documents</option>
              <option value="hindsight">Hindsight</option>
              <option value="honcho">Honcho</option>
            </FormSelect>
            <p className="text-sm text-muted-foreground">
              Documents keeps memories as files you can read and edit under Files &rsaquo; Memory.
              Hindsight and Honcho require a connected API key in Providers.
            </p>
          </div>

          <div>
            <label
              htmlFor="memories_save_enabled"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Memories Save Enabled
            </label>
            <Switch
              id="memories_save_enabled"
              checked={formData.memories_save_enabled}
              onChange={(e) =>
                updateFormData({
                  memories_save_enabled: e.target.checked,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Allow Polychat to save and use memories when responding.
            </p>
          </div>

          <div>
            <label
              htmlFor="memories_chat_history_enabled"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Memories Chat History Enabled
            </label>
            <Switch
              id="memories_chat_history_enabled"
              checked={formData.memories_chat_history_enabled}
              onChange={(e) =>
                updateFormData({
                  memories_chat_history_enabled: e.target.checked,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Allow Polychat to save and use your chat history when responding.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Privacy &amp; Data">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="temporary_chats_default"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Start chats as temporary by default
            </label>
            <Switch
              id="temporary_chats_default"
              checked={formData.temporary_chats_default}
              onChange={(e) =>
                updateFormData({
                  temporary_chats_default: e.target.checked,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              New chats start as temporary and stay on this device.
            </p>
          </div>

          <div>
            <label
              htmlFor="tracking_enabled"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Allow Prompt and Response Training Data
            </label>
            <Switch
              id="tracking_enabled"
              checked={formData.tracking_enabled}
              onChange={(e) =>
                updateFormData({
                  tracking_enabled: e.target.checked,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Allow Polychat to save conversation prompts and responses for improving AI models. We
              still collect operational usage and performance metrics without prompt content.
            </p>
          </div>

          <div>
            <label
              htmlFor="advertise_machines"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Let other devices see this desktop
            </label>
            <Switch
              id="advertise_machines"
              checked={formData.advertise_machines}
              onChange={(e) =>
                updateFormData({
                  advertise_machines: e.target.checked,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Share this desktop&apos;s name and available model names with your signed-in devices.
              Prompts, responses, and endpoint addresses stay on this desktop.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Audio">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="transcription_provider"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Transcription Provider
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the provider for speech-to-text transcription used by Polychat.
            </p>
            <FormSelect
              id="transcription_provider"
              name="transcription_provider"
              value={formData.transcription_provider}
              onChange={handleTranscriptionProviderChange}
            >
              {transcriptionProviderOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <label
              htmlFor="transcription_model"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Transcription Model
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Select from the available models for the {formData.transcription_provider} provider.
            </p>
            <FormSelect
              id="transcription_model"
              name="transcription_model"
              value={formData.transcription_model}
              onChange={(e) =>
                updateFormData({
                  transcription_model: e.target.value,
                })
              }
            >
              {getTranscriptionModelOptions(formData.transcription_provider).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <label
              htmlFor="speech_provider"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Speech Provider
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the provider for text-to-speech response audio.
            </p>
            <FormSelect
              id="speech_provider"
              name="speech_provider"
              value={formData.speech_provider}
              onChange={handleSpeechProviderChange}
            >
              {speechProviderOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <label
              htmlFor="speech_model"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Speech Model
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Select from the available voices or models for the {formData.speech_provider}{" "}
              provider.
            </p>
            <FormSelect
              id="speech_model"
              name="speech_model"
              value={formData.speech_model}
              onChange={(e) =>
                updateFormData({
                  speech_model: e.target.value,
                })
              }
            >
              {getSpeechModelOptions(formData.speech_provider).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </FormSelect>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Web Search">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="search_provider"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Search Provider
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the default search provider for web search requests.
            </p>
            <FormSelect
              id="search_provider"
              name="search_provider"
              value={formData.search_provider}
              onChange={(e) => {
                updateFormData({
                  search_provider: e.target.value,
                });

                analytics.track({
                  name: "search_provider_changed",
                  category: "ui_interaction",
                  properties: {
                    provider: e.target.value,
                  },
                });
              }}
            >
              <option value="">Default</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="tavily">Tavily</option>
              <option value="serper">Serper</option>
              <option value="perplexity">Perplexity</option>
              <option value="parallel">Parallel</option>
              <option value="exa">Exa</option>
            </FormSelect>
            <p className="mt-2 text-sm text-muted-foreground">
              Configure provider keys in the providers section before selecting BYOK providers.
            </p>
          </div>
        </div>
      </SettingsSection>

      {saveSuccess && (
        <div className="rounded-md border border-success/45 bg-success/12 p-3 text-success">
          Settings saved successfully!
        </div>
      )}

      {saveError && (
        <div className="rounded-md border border-failure/45 bg-failure/12 p-3 text-failure">
          {saveError}
        </div>
      )}

      {showSubmit && (
        <div className="pt-4">
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}
    </form>
  );
}
