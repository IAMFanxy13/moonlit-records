import { compileArrangement } from "../lib/arrangement-compiler";
import { parseFilenameMetadata } from "./filename-metadata";
import { analyzePcmToSketch, type PcmInput } from "./pcm-sketch";
import type { ImportProgress, PrivateSongRecord } from "./types";
import { ImportMediaError } from "./types";

interface AnalyzerDependencies {
  decode?: (file: File) => Promise<PcmInput>;
  checksum?: (file: File) => Promise<string>;
}

const SUPPORTED_EXTENSIONS = /\.(mp3|wav|flac|m4a|aac|ogg|mp4|mov|webm)$/iu;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_DURATION_MS = 30 * 60 * 1000;

function durationLabel(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function decodeInBrowser(file: File): Promise<PcmInput> {
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) throw new ImportMediaError("UNSUPPORTED_MEDIA", "This browser cannot decode recordings.");
  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const samples = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const channelData = buffer.getChannelData(channel);
      for (let index = 0; index < samples.length; index += 1) samples[index] += channelData[index] / buffer.numberOfChannels;
    }
    return { samples, sampleRate: buffer.sampleRate };
  } catch {
    throw new ImportMediaError(
      "UNSUPPORTED_MEDIA",
      "This recording could not be decoded. Try MP3, WAV, M4A, or a video with AAC audio.",
    );
  } finally {
    await context.close();
  }
}

async function checksumFile(file: File): Promise<string> {
  if (globalThis.crypto?.subtle && typeof file.arrayBuffer === "function") {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)].slice(0, 10).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  const source = `${file.name}:${file.size}:${file.lastModified}`;
  let hash = 2166136261;
  for (const character of source) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function analyzeMediaFile(
  file: File,
  onProgress: (progress: ImportProgress) => void,
  dependencies: AnalyzerDependencies = {},
): Promise<PrivateSongRecord> {
  if (file.size > MAX_FILE_BYTES) throw new ImportMediaError("FILE_TOO_LARGE", "Choose a recording smaller than 512 MB.");
  if (!(file.type.startsWith("audio/") || file.type.startsWith("video/") || SUPPORTED_EXTENSIONS.test(file.name))) {
    throw new ImportMediaError("UNSUPPORTED_MEDIA", "Choose an audio or video recording.");
  }

  onProgress({ stage: "preparing", detail: "Opening the recording privately on this device." });
  const [pcm, checksum] = await Promise.all([
    (dependencies.decode ?? decodeInBrowser)(file),
    (dependencies.checksum ?? checksumFile)(file),
  ]);
  const metadata = parseFilenameMetadata(file.name);
  const durationMs = (pcm.samples.length / pcm.sampleRate) * 1000;
  if (durationMs > MAX_DURATION_MS) throw new ImportMediaError("MEDIA_TOO_LONG", "Choose a recording shorter than 30 minutes.");

  onProgress({ stage: "identifying", detail: "Reading the title and artist, with no subscription required." });
  onProgress({ stage: "separating", detail: "Using a mix-safe on-device fallback; the recording never leaves your browser." });
  onProgress({ stage: "lyrics", detail: "Keeping lyric recovery optional so missing words never stop the arrangement." });
  onProgress({ stage: "melody", detail: "Tracing audible pitch, pulse, and phrase energy." });
  const evidence = analyzePcmToSketch(pcm);

  onProgress({ stage: "arranging", detail: "Reducing the recording to one-key piano events." });
  const song = compileArrangement({
    id: `import-${checksum}`,
    title: metadata.title,
    artist: metadata.artist,
    version: "Private On-device Piano Sketch",
    lyricLanguage: "en",
    lyrics: [],
    instrumental: evidence.events.map((event) => ({
      notes: event.notes,
      velocity: event.velocity,
      confidence: event.confidence,
      provenance: ["browser-pcm-sketch"],
    })),
    recommendedPiano: "warm",
  });
  song.durationLabel = durationLabel(evidence.durationMs);
  song.quality = evidence.quality;
  song.provenance = ["private-import", "browser-pcm-sketch"];
  song.events.forEach((event, index) => {
    const source = evidence.events[index];
    event.sourceStartMs = source.startMs;
    event.sourceEndMs = source.startMs + source.durationMs;
  });

  onProgress({ stage: "ready", detail: "A playable private piano sketch is ready." });
  return {
    id: `import-${checksum}`,
    checksum,
    sourceName: file.name,
    createdAt: new Date().toISOString(),
    metadata: { ...metadata, durationMs: evidence.durationMs },
    song,
    warnings: evidence.warnings,
  };
}
