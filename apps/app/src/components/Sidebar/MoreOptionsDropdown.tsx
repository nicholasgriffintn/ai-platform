import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import { MoreOptionsDropdown as ControlledMoreOptionsDropdown } from "@ngriffin_uk/polychat-component-navigation";
import { SOURCE_CODE_URL } from "@ngriffin_uk/polychat-library-client";

interface MoreOptionsDropdownProps {
  position?: "top" | "bottom";
  onShowKeyboardShortcuts: () => void;
}

export const MoreOptionsDropdown = ({
  position = "bottom",
  onShowKeyboardShortcuts,
}: MoreOptionsDropdownProps) => (
  <ControlledMoreOptionsDropdown
    position={position}
    privacyHref="/privacy"
    termsHref="/terms"
    sourceCodeUrl={SOURCE_CODE_URL}
    sourceCodeIcon={<ProviderGlyph name="github" size={16} />}
    onShowKeyboardShortcuts={onShowKeyboardShortcuts}
  />
);
