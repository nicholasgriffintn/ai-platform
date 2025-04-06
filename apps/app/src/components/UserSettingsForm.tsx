import { type FormEvent, useState } from "react";

import { Button, Select, Switch, TextArea, TextInput } from "~/components/ui";
import { useAuthStatus } from "~/hooks/useAuth";

interface UserSettingsFormProps {
  userSettings: any;
  isAuthenticated: boolean;
}

export function UserSettingsForm({
  userSettings,
  isAuthenticated,
}: UserSettingsFormProps) {
  const { updateUserSettings, isUpdatingUserSettings } = useAuthStatus();
  const [formData, setFormData] = useState({
    nickname: userSettings?.nickname || "",
    job_role: userSettings?.job_role || "",
    traits: userSettings?.traits || "",
    preferences: userSettings?.preferences || "",
    guardrails_enabled: userSettings?.guardrails_enabled || false,
    guardrails_provider: userSettings?.guardrails_provider || "llamaguard",
    bedrock_guardrail_id: userSettings?.bedrock_guardrail_id || "",
    bedrock_guardrail_version: userSettings?.bedrock_guardrail_version || "1",
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
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError("");

    try {
      await updateUserSettings(formData);

      setSaveSuccess(true);
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveError("Failed to save settings. Please try again.");
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
          <TextInput
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
          <TextInput
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
          <TextArea
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
          <TextArea
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
          <Select
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
          </Select>
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
              <TextInput
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
              <TextInput
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
              your guardrail provider in the providers section for this to work.
            </p>
          </>
        )}
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
