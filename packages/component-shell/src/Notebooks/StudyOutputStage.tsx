import { StudyOutputView } from "@ngriffin_uk/polychat-component-content";
import { useStudyProgress, useVideoOverviewMedia } from "@ngriffin_uk/polychat-library-react";
import {
  VIDEO_OVERVIEW_OUTPUT_KIND,
  videoOverviewOutputContentSchema,
  type Output,
} from "@ngriffin_uk/polychat-schemas";

function readSceneImages(output: Output): boolean[] {
  if (output.kind !== VIDEO_OVERVIEW_OUTPUT_KIND) {
    return [];
  }

  const video = videoOverviewOutputContentSchema.safeParse(output.content);

  return video.success ? video.data.scenes.map((scene) => scene.image) : [];
}

export function StudyOutputStage({
  output,
  onAskAbout,
}: {
  output: Output;
  onAskAbout?: (topic: string) => void;
}) {
  const notebookId = output.collectionId ?? "";
  const { query, save } = useStudyProgress(notebookId, output.id);
  const media = useVideoOverviewMedia({
    notebookId: output.kind === VIDEO_OVERVIEW_OUTPUT_KIND ? notebookId : "",
    outputId: output.id,
    sceneHasImage: readSceneImages(output),
    hasNarration: Boolean(output.file),
  });

  return (
    <StudyOutputView
      kind={output.kind}
      title={output.title}
      content={output.content}
      progress={notebookId ? query.data : undefined}
      onProgressChange={notebookId ? (progress) => save.mutate(progress) : undefined}
      narration={media.narration}
      sceneImages={media.sceneImages}
      isMediaLoading={media.isLoading}
      onAskAbout={onAskAbout}
    />
  );
}
