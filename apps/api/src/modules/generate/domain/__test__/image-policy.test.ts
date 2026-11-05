import { describe, expect, it } from "vitest";

import { readGenerationInput } from "../image-policy";

describe("readGenerationInput", () => {
  it("screens text and images from any field, not only prompt", () => {
    expect(
      readGenerationInput({
        prompt: "first placeholder",
        instruction: "second placeholder",
        image: "https://example.com/one.png",
        input_images: ["data:image/png;base64,AAAA", "https://example.com/two.png"],
        steps: 4,
      }),
    ).toEqual({
      text: "first placeholder\nsecond placeholder",
      images: [
        "https://example.com/one.png",
        "data:image/png;base64,AAAA",
        "https://example.com/two.png",
      ],
      videos: [],
    });
  });

  it("separates video references and leaves audio out", () => {
    expect(
      readGenerationInput({
        reference_videos: ["https://example.com/clip.mp4"],
        reference_audios: ["https://example.com/sound.mp3"],
        video_prompt: "placeholder",
      }),
    ).toEqual({
      text: "placeholder",
      images: [],
      videos: ["https://example.com/clip.mp4"],
    });
  });
});
