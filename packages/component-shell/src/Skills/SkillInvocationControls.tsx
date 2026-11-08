import { Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  readSkillDocumentInvocation,
  setSkillDocumentInvocation,
} from "@ngriffin_uk/polychat-schemas";

interface SkillInvocationControlsProps {
  content: string;
  disabled?: boolean;
  onChange: (content: string) => void;
}

export function SkillInvocationControls({
  content,
  disabled = false,
  onChange,
}: SkillInvocationControlsProps) {
  const flags = readSkillDocumentInvocation(content);

  return (
    <div className="space-y-4">
      <Switch
        label="Slash command"
        description="Show this skill in the composer's / menu so people can run it directly."
        checked={flags.userInvocable}
        disabled={disabled || flags.disableModelInvocation}
        onChange={(event) =>
          onChange(
            setSkillDocumentInvocation(content, { ...flags, userInvocable: event.target.checked }),
          )
        }
      />
      <Switch
        label="Only when invoked"
        description="The assistant never picks this skill by itself. Use it for workflows people should start on purpose."
        checked={flags.disableModelInvocation}
        disabled={disabled || !flags.userInvocable}
        onChange={(event) =>
          onChange(
            setSkillDocumentInvocation(content, {
              ...flags,
              disableModelInvocation: event.target.checked,
            }),
          )
        }
      />
    </div>
  );
}
