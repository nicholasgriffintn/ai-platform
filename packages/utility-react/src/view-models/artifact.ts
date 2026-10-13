export interface ArtifactProps {
  identifier: string;
  type: string;
  language?: string;
  title?: string;
  display?: "panel" | "inline";
  content: string;
  source?: { conversationId: string; messageId: string };
  onOpen?: (artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => void;
}
