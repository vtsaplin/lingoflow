import { spawn } from "child_process";
import { Buffer } from "node:buffer";

export function convertWebmToWav(webmBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-f", "wav",
      "-ar", "16000",
      "-ac", "1",
      "-acodec", "pcm_s16le",
      "pipe:1"
    ]);

    const chunks: Buffer[] = [];

    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", () => {});
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
    ffmpeg.on("error", reject);

    ffmpeg.stdin.write(webmBuffer);
    ffmpeg.stdin.end();
  });
}
