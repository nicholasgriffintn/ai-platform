export const TEXT_MESSAGE_CASES = [
  { name: "plain text", value: "Hello from release validation" },
  {
    name: "multiline and Unicode",
    value: "First release line\n\nSecond line with 👋 こんにちは 你好",
  },
  {
    name: "code and special characters",
    value: "Explain `const ready = true` with @mentions, #hashtags, and $variables.",
  },
] as const;

export function createSilentWavFixture() {
  const sampleRate = 8_000;
  const sampleCount = 800;
  const bytesPerSample = 2;
  const dataLength = sampleCount * bytesPerSample;
  const wav = Buffer.alloc(44 + dataLength);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * bytesPerSample, 28);
  wav.writeUInt16LE(bytesPerSample, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataLength, 40);

  return wav;
}

export function createGitHubPrivateKeyFixture() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

import { generateKeyPairSync } from "node:crypto";
