import { compileArrangement } from "../lib/arrangement-compiler";
import { transcribeWithBasicPitch } from "./basic-pitch-transcriber";
import { parseFilenameMetadata } from "./filename-metadata";
import { analyzePcmToSketch, type PcmInput } from "./pcm-sketch";
import type { AnalysisEvidence, ImportProgress, PrivateSongRecord } from "./types";
import { ImportMediaError } from "./types";

interface AnalyzerDependencies {
  decode?: (file: File) => Promise<PcmInput>;
  checksum?: (file: File) => Promise<string>;
  transcribe?: (pcm: PcmInput, onProgress: (fraction: number) => void) => Promise<AnalysisEvidence>;
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

  onProgress({ stage: "preparing", detail: "Decoding the complete recording privately on this device.", fraction: 0 });
  const [pcm, checksum] = await Promise.all([
    (dependencies.decode ?? decodeInBrowser)(file),
    (dependencies.checksum ?? checksumFile)(file),
  ]);
  const metadata = parseFilenameMetadata(file.name);
  const durationMs = (pcm.samples.length / pcm.sampleRate) * 1000;
  if (durationMs > MAX_DURATION_MS) throw new ImportMediaError("MEDIA_TOO_LONG", "Choose a recording shorter than 30 minutes.");

  onProgress({ stage: "identifying", detail: "Reading filename metadata before optional free song lookup.", fraction: 0.04 });
  onProgress({
    stage: "transcribing",
    detail: "Loading Spotify Basic Pitch and analysing every window locally.",
    fraction: 0.08,
    method: "neural",
  });

  let evidence: AnalysisEvidence;
  let analysisMethod: "neural" | "fallback" = "neural";
  let analysisFraction = 0.08;
  try {
    evidence = await (dependencies.transcribe ?? transcribeWithBasicPitch)(pcm, (fraction) => {
      analysisFraction = Math.max(analysisFraction, 0.08 + Math.max(0, Math.min(1, fraction)) * 0.84);
      onProgress({
        stage: "transcribing",
        detail: `Local transcription ${Math.round(fraction * 100)}% complete.`,
        fraction: analysisFraction,
        method: "neural",
      });
    });
  } catch {
    analysisMethod = "fallback";
    onProgress({
      stage: "transcribing",
      detail: "Neural transcription was unavailable; building an honest local rhythm sketch.",
      fraction: analysisFraction,
      method: "fallback",
    });
    const sketch = analyzePcmToSketch(pcm);
    evidence = {
      ...sketch,
      warnings: [...sketch.warnings, "NEURAL_TRANSCRIPTION_UNAVAILABLE"],
    };
  }

  onProgress({ stage: "arranging", detail: "Reducing simultaneous notes to one-key piano gestures.", fraction: 0.94, method: analysisMethod });
  const provenance = analysisMethod === "neural" ? "spotify-basic-pitch" : "browser-pcm-sketch";
  const song = compileArrangement({
    id: `import-${checksum}`,
    title: metadata.title,
    artist: metadata.artist,
    version: evidence.quality === "sketch" ? "Private Fallback Piano Sketch" : "Private Local Piano Transcription",
    lyricLanguage: "en",
    lyrics: [],
    instrumental: evidence.events.map((event) => ({
      notes: event.notes,
      durationMs: event.durationMs,
      kind: event.durationMs >= 600 ? "hold" : "tap",
      holdMs: event.durationMs >= 600 ? event.durationMs : undefined,
      velocity: event.velocity,
      confidence: event.confidence,
      provenance: [provenance],
    })),
    recommendedPiano: "warm",
  });
  song.durationLabel = durationLabel(evidence.durationMs);
  song.quality = evidence.quality;
  song.provenance = ["private-import", provenance];
  song.events.forEach((event, index) => {
    const source = evidence.events[index];
    event.sourceStartMs = source.startMs;
    event.sourceEndMs = source.startMs + source.durationMs;
  });

  onProgress({
    stage: "ready",
    detail: evidence.quality === "sketch" ? "A playable fallback sketch is ready." : "A locally transcribed piano arrangement is ready.",
    fraction: 1,
    method: analysisMethod,
  });
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
