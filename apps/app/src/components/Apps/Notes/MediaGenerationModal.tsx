import { memo, useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea as UITextarea,
} from "~/components/ui";
import { useGenerateNotesFromMedia } from "~/hooks/useNotes";

interface MediaGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotesGenerated: (content: string) => void;
}

export const MediaGenerationModal = memo(function MediaGenerationModal({
  isOpen,
  onClose,
  onNotesGenerated,
}: MediaGenerationModalProps) {
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>([
    "concise_summary",
  ]);
  const [noteType, setNoteType] = useState<string>("general");
  const [extraPrompt, setExtraPrompt] = useState<string>("");
  const [withTimestamps, setWithTimestamps] = useState<boolean>(false);
  const [useVideoAnalysis, setUseVideoAnalysis] = useState<boolean>(false);
  const [enableVideoSearch, setEnableVideoSearch] = useState<boolean>(false);

  const generateNotesMutation = useGenerateNotesFromMedia();

  const handleGenerate = async () => {
    if (!mediaUrl || selectedOutputs.length === 0) {
      toast.error("Provide a URL and select at least one output");
      return;
    }
    try {
      // TODO: type this
      const result = await generateNotesMutation.mutateAsync({
        url: mediaUrl,
        outputs: selectedOutputs as any,
        noteType: noteType as any,
        extraPrompt,
        timestamps: withTimestamps,
        useVideoAnalysis,
        enableVideoSearch,
      });
      onNotesGenerated(result.content);
      onClose();
      toast.success("Generated notes added to editor");
    } catch {
      toast.error("Failed to generate notes from URL");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} width="700px">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Notes from Media URL</DialogTitle>
          <DialogDescription>
            Provide an audio/video URL, choose outputs, and generate structured
            notes. Enable video intelligence for advanced scene analysis and
            visual insights.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <label htmlFor="media-url" className="sr-only">
            Media URL
          </label>
          <input
            id="media-url"
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https:// or s3://"
            className="w-full border rounded p-2 bg-transparent"
          />

          <div>
            <label htmlFor="note-type" className="text-sm font-medium">
              Note type
            </label>
            <select
              id="note-type"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="mt-2 w-full bg-transparent border rounded p-2"
            >
              {[
                "general",
                "meeting",
                "training",
                "lecture",
                "interview",
                "podcast",
                "webinar",
                "tutorial",
                "video_content",
                "educational_video",
                "documentary",
                "other",
              ].map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>

            <label
              htmlFor="timestamps"
              className="mt-3 flex items-center gap-2 text-sm"
            >
              <input
                id="timestamps"
                type="checkbox"
                checked={withTimestamps}
                onChange={(e) => setWithTimestamps(e.target.checked)}
              />
              Include timestamps
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-sm font-medium">Outputs</span>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {[
                  { id: "concise_summary", label: "Concise summary" },
                  { id: "detailed_outline", label: "Detailed outline" },
                  { id: "key_takeaways", label: "Key takeaways" },
                  { id: "action_items", label: "Action items" },
                  { id: "meeting_minutes", label: "Meeting minutes" },
                  { id: "qa_extraction", label: "Q&A extraction" },
                  {
                    id: "scene_analysis",
                    label: "Scene analysis",
                    videoOnly: true,
                  },
                  {
                    id: "visual_insights",
                    label: "Visual insights",
                    videoOnly: true,
                  },
                  {
                    id: "smart_timestamps",
                    label: "Smart timestamps",
                    videoOnly: true,
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2 text-sm ${
                      opt.videoOnly && !useVideoAnalysis
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOutputs.includes(opt.id)}
                      disabled={opt.videoOnly && !useVideoAnalysis}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedOutputs((prev) =>
                          checked
                            ? Array.from(new Set([...prev, opt.id]))
                            : prev.filter((v) => v !== opt.id),
                        );
                      }}
                    />
                    {opt.label}
                    {opt.videoOnly && (
                      <span className="text-xs text-blue-500 font-medium">
                        VIDEO
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                  🎥 Video Intelligence
                </h3>
                <div className="space-y-3">
                  <label
                    htmlFor="video-analysis"
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      id="video-analysis"
                      type="checkbox"
                      checked={useVideoAnalysis}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseVideoAnalysis(checked);
                        if (!checked) {
                          setSelectedOutputs((prev) =>
                            prev.filter(
                              (output) =>
                                ![
                                  "scene_analysis",
                                  "visual_insights",
                                  "smart_timestamps",
                                ].includes(output),
                            ),
                          );
                          setEnableVideoSearch(false);
                        }
                      }}
                    />
                    <div>
                      <span className="font-medium">
                        Advanced video analysis
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Analyze visual content, scenes, gestures, and on-screen
                        text
                      </p>
                    </div>
                  </label>

                  <label
                    htmlFor="video-search"
                    className={`flex items-center gap-2 text-sm ${
                      !useVideoAnalysis ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <input
                      id="video-search"
                      type="checkbox"
                      checked={enableVideoSearch}
                      disabled={!useVideoAnalysis}
                      onChange={(e) => setEnableVideoSearch(e.target.checked)}
                    />
                    <div>
                      <span className="font-medium">Enable video search</span>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Generate embeddings for semantic search across video
                        content
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <label htmlFor="extra-prompt" className="text-sm font-medium">
            Additional instructions
          </label>
          <UITextarea
            id="extra-prompt"
            value={extraPrompt}
            onChange={(e) => setExtraPrompt(e.target.value)}
            placeholder="Add any specifics to guide the output..."
            className="h-24"
          />

          <DialogFooter>
            <Button
              variant="primary"
              onClick={handleGenerate}
              isLoading={generateNotesMutation.status === "pending"}
              disabled={generateNotesMutation.status === "pending"}
              className="mr-2"
            >
              {generateNotesMutation.status === "pending"
                ? "Generating..."
                : "Generate"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
});
