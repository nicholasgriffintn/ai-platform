import {
  FLASHCARDS_OUTPUT_KIND,
  flashcardsOutputContentSchema,
  MIND_MAP_OUTPUT_KIND,
  mindMapOutputContentSchema,
  QUIZ_OUTPUT_KIND,
  quizOutputContentSchema,
  VIDEO_OVERVIEW_OUTPUT_KIND,
  videoOverviewOutputContentSchema,
  type StudyProgress,
} from "@ngriffin_uk/polychat-schemas";

import { FlashcardsView } from "./FlashcardsView";
import { MindMapView } from "./MindMapView";
import { QuizView } from "./QuizView";
import { VideoOverviewView } from "./VideoOverviewView";

const STUDY_OUTPUT_KINDS = new Set<string>([
  MIND_MAP_OUTPUT_KIND,
  FLASHCARDS_OUTPUT_KIND,
  QUIZ_OUTPUT_KIND,
  VIDEO_OVERVIEW_OUTPUT_KIND,
]);

const NO_SCENE_IMAGES: readonly (Blob | null)[] = [];

export function isStudyOutputKind(kind: string): boolean {
  return STUDY_OUTPUT_KINDS.has(kind);
}

export interface StudyOutputViewProps {
  kind: string;
  title: string;
  content: unknown;
  progress?: StudyProgress;
  onProgressChange?: (progress: StudyProgress) => void;
  narration?: Blob | null;
  sceneImages?: readonly (Blob | null)[];
  isMediaLoading?: boolean;
  onAskAbout?: (topic: string) => void;
}

export function StudyOutputView({
  kind,
  title,
  content,
  progress,
  onProgressChange,
  narration = null,
  sceneImages = NO_SCENE_IMAGES,
  isMediaLoading = false,
  onAskAbout,
}: StudyOutputViewProps) {
  if (kind === MIND_MAP_OUTPUT_KIND) {
    const parsed = mindMapOutputContentSchema.safeParse(content);

    return parsed.success ? <MindMapView content={parsed.data} onAskAbout={onAskAbout} /> : null;
  }

  if (kind === FLASHCARDS_OUTPUT_KIND) {
    const parsed = flashcardsOutputContentSchema.safeParse(content);

    return parsed.success ? (
      <FlashcardsView
        content={parsed.data}
        progress={progress}
        onProgressChange={onProgressChange}
      />
    ) : null;
  }

  if (kind === QUIZ_OUTPUT_KIND) {
    const parsed = quizOutputContentSchema.safeParse(content);

    return parsed.success ? (
      <QuizView content={parsed.data} progress={progress} onProgressChange={onProgressChange} />
    ) : null;
  }

  if (kind === VIDEO_OVERVIEW_OUTPUT_KIND) {
    const parsed = videoOverviewOutputContentSchema.safeParse(content);

    return parsed.success ? (
      <VideoOverviewView
        title={title}
        content={parsed.data}
        narration={narration}
        sceneImages={sceneImages}
        isLoading={isMediaLoading}
      />
    ) : null;
  }

  return null;
}
