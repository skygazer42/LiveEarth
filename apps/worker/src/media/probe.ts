import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { StreamProbeResult } from "@liveearth/domain/types";

const execFileAsync = promisify(execFile);

interface ProbeOutput {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    bit_rate?: string;
  }>;
  format?: { bit_rate?: string };
}

export async function probeStream(sourceUrl: string): Promise<StreamProbeResult> {
  const startedAt = Date.now();
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,bit_rate:format=bit_rate",
        "-of",
        "json",
        sourceUrl,
      ],
      { timeout: 12_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout) as ProbeOutput;
    const video = parsed.streams?.find((stream) => stream.codec_type === "video");
    const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
    const bitrate = Number(video?.bit_rate ?? parsed.format?.bit_rate ?? 0) / 1_000;
    const flags: StreamProbeResult["flags"] = [];
    if (bitrate > 0 && bitrate < 450) flags.push("low-bitrate");
    if (!audio) flags.push("silent");
    return {
      ok: Boolean(video),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      bitrateKbps: Math.round(bitrate),
      width: video?.width ?? 0,
      height: video?.height ?? 0,
      videoCodec: video?.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      flags,
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      bitrateKbps: 0,
      width: 0,
      height: 0,
      videoCodec: null,
      audioCodec: null,
      flags: [],
      error: error instanceof Error ? error.message : "Unknown ffprobe failure",
    };
  }
}
