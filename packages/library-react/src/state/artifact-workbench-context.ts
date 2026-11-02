import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import type { ArtifactProps } from "@ngriffin_uk/polychat-utility-react";
import { createContext } from "react";

export interface ArtifactWorkbenchValue {
  currentArtifact: ArtifactProps | null;
  currentArtifacts: ArtifactProps[];
  isPanelVisible: boolean;
  isCombinedPanel: boolean;
  openCount: number;
  openArtifact: (artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => void;
  replaceArtifact: (artifact: ArtifactProps) => void;
  closePanel: () => void;
  copied: boolean;
  copyArtifact: (value: string) => void;
  artifactAttachments: AttachmentData[];
  addArtifactSelection: (attachment: AttachmentData) => void;
  removeArtifactAttachment: (index: number) => void;
  clearArtifactAttachments: () => void;
  registerComposerFocus: (focus: () => void) => void;
}

export const ArtifactWorkbenchContext = createContext<ArtifactWorkbenchValue | null>(null);
