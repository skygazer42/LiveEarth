import { spawn } from "node:child_process";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function captureContactSheet(sourceUrl: string): Promise<string> {
  const chunks: Buffer[] = [];
  let byteLength = 0;

  return await new Promise((resolve, reject) => {
    const process = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        sourceUrl,
        "-t",
        "30",
        "-vf",
        "fps=1/5,scale=512:-2:flags=lanczos,tile=3x2",
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const timeout = setTimeout(() => {
      process.kill("SIGKILL");
      reject(new Error("Contact sheet capture timed out"));
    }, 45_000);

    process.stdout.on("data", (chunk: Buffer) => {
      byteLength += chunk.length;
      if (byteLength > MAX_IMAGE_BYTES) {
        process.kill("SIGKILL");
        reject(new Error("Contact sheet exceeded the size limit"));
        return;
      }
      chunks.push(chunk);
    });
    const stderr: Buffer[] = [];
    process.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    process.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    process.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`ffmpeg failed (${code}): ${Buffer.concat(stderr).toString("utf8").slice(-500)}`));
        return;
      }
      resolve(`data:image/png;base64,${Buffer.concat(chunks).toString("base64")}`);
    });
  });
}
