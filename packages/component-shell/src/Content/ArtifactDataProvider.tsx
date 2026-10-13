import {
  ArtifactBindingReaderProvider,
  type ArtifactBindingReader,
} from "@ngriffin_uk/polychat-component-content";
import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { ReactNode } from "react";

const readArtifactBinding: ArtifactBindingReader = async (request) =>
  (
    await apiService.readArtifactBinding(request.conversationId, {
      messageId: request.messageId,
      artifactIdentifier: request.artifactIdentifier,
      bindingId: request.bindingId,
      args: request.args,
    })
  ).data;

export function ArtifactDataProvider({ children }: { children: ReactNode }) {
  return (
    <ArtifactBindingReaderProvider reader={readArtifactBinding}>
      {children}
    </ArtifactBindingReaderProvider>
  );
}
