import { type FormEvent, useState } from "react";

import {
  Button,
  FormInput,
  FormSelect,
  Switch,
  Textarea,
} from "~/components/ui";
import { EventCategory, useTrackEvent } from "~/hooks/use-track-event";
import { useAuthStatus } from "~/hooks/useAuth";

const transcriptionProviders = {
  workers: ["whisper", "whisper-large-v3-turbo", "nova-3"],
  mistral: ["voxtral-mini", "voxtral-small"],
  replicate: ["thomasmol /whisper-diarization"],
};

interface UserSettingsFormProps {
  userSettings: any;
  isAuthenticated: boolean;
}

export function UserSettingsForm({
  userSettings,
  isAuthenticated,
}: UserSettingsFormProps) {
  const { updateUserSettings, isUpdatingUserSettings } = useAuthStatus();
  const { trackEvent, trackError } = useTrackEvent();
  const [formData, setFormData] = useState({
    nickname: userSettings?.nickname || "",
    job_role: userSettings?.job_role || "",
    traits: userSettings?.traits || "",
    preferences: userSettings?.preferences || "",
    guardrails_enabled: userSettings?.guardrails_enabled || false,
    guardrails_provider: userSettings?.guardrails_provider || "llamaguard",
    bedrock_guardrail_id: userSettings?.bedrock_guardrail_id || "",
    bedrock_guardrail_version: userSettings?.bedrock_guardrail_version || "1",
    embedding_provider: userSettings?.embedding_provider || "vectorize",
    bedrock_knowledge_base_id: userSettings?.bedrock_knowledge_base_id || "",
    bedrock_knowledge_base_custom_data_source_id:
      userSettings?.bedrock_knowledge_base_custom_data_source_id || "",
    s3vectors_bucket_name: userSettings?.s3vectors_bucket_name || "",
    s3vectors_index_name: userSettings?.s3vectors_index_name || "",
    s3vectors_region: userSettings?.s3vectors_region || "us-east-1",
    memories_save_enabled: userSettings?.memories_save_enabled || false,
    memories_chat_history_enabled:
      userSettings?.memories_chat_history_enabled || false,
    transcription_provider: userSettings?.transcription_provider || "workers",
    transcription_model: userSettings?.transcription_model || "whisper-1",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    trackEvent({
      name: "setting_field_edited",
      category: EventCategory.UI_INTERACTION,
      properties: {
        setting_name: name,
        has_value: value.trim().length > 0 ? "true" : "false",
      },
    });
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as keyof typeof transcriptionProviders;
    const firstModelForProvider = transcriptionProviders[newProvider][0];

    setFormData((prev) => ({
      ...prev,
      transcription_provider: newProvider,
      transcription_model: firstModelForProvider,
    }));

    trackEvent({
      name: "transcription_provider_changed",
      category: EventCategory.UI_INTERACTION,
      properties: {
        provider: newProvider,
        auto_selected_model: firstModelForProvider,
      },
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError("");

    trackEvent({
      name: "settings_save_attempt",
      category: EventCategory.USER_JOURNEY,
      properties: {
        setting_names: Object.keys(formData).join(","),
        guardrails_enabled: String(formData.guardrails_enabled),
        memories_enabled: String(formData.memories_save_enabled),
      },
    });

    try {
      await updateUserSettings(formData);
      setSaveSuccess(true);

      trackEvent({
        name: "settings_saved",
        category: EventCategory.USER_JOURNEY,
        properties: {
          setting_names: Object.keys(formData).join(","),
          guardrails_enabled: String(formData.guardrails_enabled),
          memories_enabled: String(formData.memories_save_enabled),
        },
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveError("Failed to save settings. Please try again.");

      trackError("settings_save_failed", error as Error, {
        setting_names: Object.keys(formData).join(","),
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400">
        Please login to customize your settings.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-6">
          Personalised responses
        </h3>
      </div>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="nickname"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
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
          <label
            htmlFor="job_role"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
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
          <label
            htmlFor="traits"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
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
          <label
            htmlFor="preferences"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
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
      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-6">
          Guardrails
        </h3>
      </div>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="guardrails_enabled"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
            Guardrails Enabled
          </label>
          <Switch
            id="guardrails_enabled"
            checked={formData.guardrails_enabled}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                guardrails_enabled: e.target.checked,
              }))
            }
          />
        </div>
        <div>
          <label
            htmlFor="guardrails_provider"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
            Guardrails Provider
          </label>
          <FormSelect
            id="guardrails_provider"
            name="guardrails_provider"
            value={formData.guardrails_provider}
            onChange={(e) =>
              setFormData({
                ...formData,
                guardrails_provider: e.target.value,
              })
            }
          >
            <option value="llamaguard">LlamaGuard</option>
            <option value="bedrock">Bedrock</option>
          </FormSelect>
        </div>
        {formData.guardrails_provider === "bedrock" && (
          <>
            <div>
              <label
                htmlFor="bedrock_guardrail_id"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
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
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Please note that you will also need to configure the api key for
              Bedrock in the providers section for this to work.
            </p>
          </>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-6">
          Embeddings (RAG)
        </h3>
      </div>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="embedding_provider"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
            Embedding Provider
          </label>
          <FormSelect
            id="embedding_provider"
            name="embedding_provider"
            value={formData.embedding_provider}
            onChange={(e) =>
              setFormData({
                ...formData,
                embedding_provider: e.target.value,
              })
            }
          >
            <option value="vectorize">Vectorize</option>
            <option value="bedrock">Bedrock</option>
            <option value="s3vectors">S3 Vectors</option>
          </FormSelect>
        </div>
        {formData.embedding_provider === "bedrock" && (
          <>
            <div>
              <label
                htmlFor="bedrock_knowledge_base_id"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
              >
                Knowledge Base ID
              </label>
              <FormInput
                id="bedrock_knowledge_base_id"
                name="bedrock_knowledge_base_id"
                value={formData.bedrock_knowledge_base_id}
                onChange={handleChange}
                placeholder="Enter the knowledge base ID"
                className="w-full"
              />
            </div>
            <div>
              <label
                htmlFor="bedrock_knowledge_base_custom_data_source_id"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
              >
                Custom Data Source ID
              </label>
              <FormInput
                id="bedrock_knowledge_base_custom_data_source_id"
                name="bedrock_knowledge_base_custom_data_source_id"
                value={formData.bedrock_knowledge_base_custom_data_source_id}
                onChange={handleChange}
                placeholder="Enter the custom data source ID"
                className="w-full"
              />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Please note that you will also need to configure the api key for
              Bedrock in the providers section for this to work.
            </p>
          </>
        )}
        {formData.embedding_provider === "s3vectors" && (
          <>
            <div>
              <label
                htmlFor="s3vectors_bucket_name"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
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
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
              >
                Index Name (Optional)
              </label>
              <FormInput
                id="s3vectors_index_name"
                name="s3vectors_index_name"
                value={formData.s3vectors_index_name}
                onChange={handleChange}
                placeholder="Enter the index name (optional)"
                className="w-full"
              />
            </div>
            <div>
              <label
                htmlFor="s3vectors_region"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
              >
                AWS Region
              </label>
              <FormSelect
                id="s3vectors_region"
                name="s3vectors_region"
                value={formData.s3vectors_region}
                onChange={(e) =>
                  setFormData({
                    ...formData,
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Please note that you will also need to configure the AWS
              credentials for S3 Vectors in the providers section for this to
              work.
            </p>
          </>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-6">
          Memories
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="memories_save_enabled"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
            Memories Save Enabled
          </label>
          <Switch
            id="memories_save_enabled"
            checked={formData.memories_save_enabled}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                memories_save_enabled: e.target.checked,
              }))
            }
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Allow Polychat to save and use memories when responding.
          </p>
        </div>

        <div>
          <label
            htmlFor="memories_chat_history_enabled"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
            Memories Chat History Enabled
          </label>
          <Switch
            id="memories_chat_history_enabled"
            checked={formData.memories_chat_history_enabled}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                memories_chat_history_enabled: e.target.checked,
              }))
            }
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Allow Polychat to save and use your chat history when responding.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-6">
          Speech Transcription
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="transcription_provider"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
            Transcription Provider
          </label>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Choose the provider for speech-to-text transcription used by
            Polychat.
          </p>
          <FormSelect
            id="transcription_provider"
            name="transcription_provider"
            value={formData.transcription_provider}
            onChange={handleProviderChange}
          >
            {Object.keys(transcriptionProviders).map((provider) => (
              <option key={provider} value={provider}>
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </option>
            ))}
          </FormSelect>
        </div>

        <div>
          <label
            htmlFor="transcription_model"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
          >
            Transcription Model
          </label>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Select from the available models for the{" "}
            {formData.transcription_provider} provider.
          </p>
          <FormSelect
            id="transcription_model"
            name="transcription_model"
            value={formData.transcription_model}
            onChange={(e) =>
              setFormData({
                ...formData,
                transcription_model: e.target.value,
              })
            }
          >
            {transcriptionProviders[
              formData.transcription_provider as keyof typeof transcriptionProviders
            ]?.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </FormSelect>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-md border border-green-200 dark:border-green-800">
          Settings saved successfully!
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800">
          {saveError}
        </div>
      )}

      <div className="pt-4">
        <Button
          type="submit"
          variant="primary"
          disabled={isUpdatingUserSettings}
        >
          {isUpdatingUserSettings ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}
