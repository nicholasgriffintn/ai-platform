import { apiService } from "@ngriffin_uk/polychat-library-client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVoiceRecorder } from "./useVoiceRecorder.js";

const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  apiService: { transcribeAudio: vi.fn() },
}));

class FakeRecorder {
  static created: FakeRecorder[] = [];
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => Promise<void>) | null = null;

  constructor(readonly stream: { getTracks: () => { stop: () => void }[] }) {
    FakeRecorder.created.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    void this.onstop?.();
  }
}

function fakeStream() {
  const track = { stop: vi.fn() };

  return { track, stream: { getTracks: () => [track] } };
}

describe("useVoiceRecorder", () => {
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    FakeRecorder.created = [];
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  });

  it("opens the microphone once when start is pressed twice", async () => {
    const { stream } = fakeStream();

    getUserMedia.mockResolvedValue(stream);

    const { result } = renderHook(() => useVoiceRecorder({ onTranscribe: vi.fn() }));

    await act(async () => {
      await Promise.all([result.current.startRecording(), result.current.startRecording()]);
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(FakeRecorder.created).toHaveLength(1);
  });

  it("releases the microphone and skips transcription when the composer closes", async () => {
    const { stream, track } = fakeStream();

    getUserMedia.mockResolvedValue(stream);

    const { result, unmount } = renderHook(() => useVoiceRecorder({ onTranscribe: vi.fn() }));

    await act(async () => {
      await result.current.startRecording();
    });
    unmount();

    expect(track.stop).toHaveBeenCalled();
    expect(apiService.transcribeAudio).not.toHaveBeenCalled();
  });

  it("releases a microphone granted after the composer closed", async () => {
    const { stream, track } = fakeStream();
    let grant: (value: unknown) => void = () => undefined;

    getUserMedia.mockReturnValue(new Promise((resolve) => (grant = resolve)));

    const { result, unmount } = renderHook(() => useVoiceRecorder({ onTranscribe: vi.fn() }));
    const starting = result.current.startRecording();

    unmount();
    grant(stream);
    await starting;

    expect(track.stop).toHaveBeenCalled();
    expect(FakeRecorder.created).toHaveLength(0);
  });

  it("tells the person when transcription fails", async () => {
    const { stream } = fakeStream();

    getUserMedia.mockResolvedValue(stream);
    vi.mocked(apiService.transcribeAudio).mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useVoiceRecorder({ onTranscribe: vi.fn() }));

    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      result.current.stopRecording();
      await Promise.resolve();
    });

    expect(toastError).toHaveBeenCalledWith("Your recording could not be transcribed");
  });
});
