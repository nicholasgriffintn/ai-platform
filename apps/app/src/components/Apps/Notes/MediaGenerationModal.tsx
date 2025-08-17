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

  const generateNotesMutation = useGenerateNotesFromMedia();

  const handleGenerate = async () => {
    if (!mediaUrl || selectedOutputs.length === 0) {
      toast.error("Provide a URL and select at least one output");
      return;
    }
    try {
      const result = await generateNotesMutation.mutateAsync({
        url: mediaUrl,
        outputs: selectedOutputs as any,
        noteType: noteType as any,
        extraPrompt,
        timestamps: withTimestamps,
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
            notes.
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
            placeholder="https://example.com/audio-or-video.mp3"
            className="w-full border rounded p-2 bg-transparent"
          />

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
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOutputs.includes(opt.id)}
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
                  </label>
                ))}
              </div>
            </div>
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
                  "other",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
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
              variant="secondary"
              onClick={handleGenerate}
              isLoading={generateNotesMutation.status === "pending"}
              disabled={generateNotesMutation.status === "pending"}
              className="mr-2"
            >
              {generateNotesMutation.status === "pending"
                ? "Generating..."
                : "Generate"}
            </Button>
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
});
