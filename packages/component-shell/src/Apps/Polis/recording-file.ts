import { polisRecordingSchema, type PolisRecording } from "@ngriffin_uk/polychat-schemas";

function fileName(recording: PolisRecording): string {
  const slug = recording.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return `${slug}-day-${recording.day}.polis.json`;
}

export function sharedTownUrl(token: string): string {
  return `${window.location.origin}/polis/${token}`;
}

export function downloadRecording(recording: PolisRecording): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(recording)], { type: "application/json" }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName(recording);
  link.click();
  URL.revokeObjectURL(url);
}

export async function readRecording(file: File): Promise<PolisRecording> {
  const parsed = polisRecordingSchema.safeParse(JSON.parse(await file.text()));

  if (!parsed.success) {
    throw new Error("That file is not a Polis recording");
  }

  return parsed.data;
}
