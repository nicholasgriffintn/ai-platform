import type { IEnv } from "../types";
import { StorageService } from "./storage";

async function uploadFromChat(
  modelResponse: ReadableStream | string,
  env: IEnv,
  key: string,
  options: {
    contentType: string;
    mimeTypeRegex: string;
  },
) {
  let arrayBuffer: ArrayBuffer;

  if (modelResponse instanceof ReadableStream) {
    const reader = modelResponse.getReader();
    const chunks = [];
    let uploadDone = false;

    while (!uploadDone) {
      const { done, value } = await reader.read();
      if (value) {
        chunks.push(value);
      }
      uploadDone = true;
    }
    arrayBuffer = new Uint8Array(
      chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []),
    ).buffer;
  } else {
    const base64Data = modelResponse.replace(
      new RegExp(`^data:${options.mimeTypeRegex};base64,`),
      "",
    );
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  }

  const length = arrayBuffer.byteLength;

  const storageService = new StorageService(env.ASSETS_BUCKET);
  const response = await storageService.uploadObject(key, arrayBuffer, {
    contentType: options.contentType,
    contentLength: length,
  });

  return response;
}

export async function uploadImageFromChat(
  modelResponse: ReadableStream | string,
  env: IEnv,
  imageKey: string,
) {
  return uploadFromChat(modelResponse, env, imageKey, {
    contentType: "image/png",
    mimeTypeRegex: "image\\/\\w+",
  });
}

export async function uploadAudioFromChat(
  modelResponse: ReadableStream | string,
  env: IEnv,
  audioKey: string,
) {
  return uploadFromChat(modelResponse, env, audioKey, {
    contentType: "audio/mp3",
    mimeTypeRegex: "audio\\/\\w+",
  });
}
