import { compileJianpuSong } from "./jianpu-song-compiler";
import { parseJianpuPages } from "./jianpu-parser";
import type { RecognizedScorePage } from "./jianpu-types";
import { recognizeScorePages } from "./local-score-recognizer";
import { loadScorePages, type LoadedScorePage } from "./score-page-loader";
import { ImportScoreError, type ImportProgress, type PrivateSongRecord } from "./types";

interface ScoreAnalyzerDependencies {
  checksum(files: File[]): Promise<string>;
  loadPages(files: File[]): Promise<LoadedScorePage[]>;
  recognizePages(
    pages: LoadedScorePage[],
    onPage?: (completed: number, total: number) => void,
  ): Promise<RecognizedScorePage[]>;
}

function readableFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/u, "");
  return withoutExtension.replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").trim() || "Untitled Score";
}

async function checksumFiles(files: File[]): Promise<string> {
  const source = files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return [...new Uint8Array(digest)]
      .slice(0, 10)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  let hash = 2166136261;
  for (const character of source) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const DEFAULT_DEPENDENCIES: ScoreAnalyzerDependencies = {
  checksum: checksumFiles,
  loadPages: loadScorePages,
  recognizePages: (pages, onPage) => recognizeScorePages(pages, {}, onPage),
};

export async function analyzeScoreFiles(
  files: File[],
  onProgress: (progress: ImportProgress) => void,
  dependencies: Partial<ScoreAnalyzerDependencies> = {},
): Promise<PrivateSongRecord> {
  const runtime = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  onProgress({ stage: "preparing", detail: "Checking score files on this device.", fraction: 0.02 });
  const checksum = await runtime.checksum(files);

  onProgress({ stage: "rendering", detail: "Rendering clean local score pages.", fraction: 0.1 });
  const pages = await runtime.loadPages(files);

  onProgress({
    stage: "recognizing",
    detail: "Loading the bundled Chinese score reader. The first run may take a moment.",
    fraction: 0.18,
    method: "neural",
  });
  const recognizedPages = await runtime.recognizePages(pages, (completed, total) => {
    onProgress({
      stage: "recognizing",
      detail: `Reading page ${completed} of ${total} locally.`,
      fraction: 0.18 + (completed / Math.max(1, total)) * 0.54,
      method: "neural",
    });
  });

  onProgress({
    stage: "interpreting",
    detail: "Applying Jianpu pitch, rhythm, rest, and lyric rules.",
    fraction: 0.78,
  });
  const parsed = parseJianpuPages(recognizedPages, {
    fallbackTitle: readableFilename(files[0]?.name ?? "Untitled Score"),
  });
  if (parsed.rows.length === 0 || parsed.rows.every((row) => row.notes.length === 0)) {
    throw new ImportScoreError(
      "NO_JIANPU",
      "No numbered notation was found. Try a clearer crop with the 0–7 score rows visible.",
    );
  }

  onProgress({
    stage: "arranging",
    detail: "Routing lyrics and unvoiced notes onto your keyboard.",
    fraction: 0.9,
  });
  const id = `score-${checksum}`;
  const song = compileJianpuSong(parsed, id);
  const durationMs = song.events.reduce(
    (maximum, event) => Math.max(maximum, event.sourceEndMs ?? 0),
    0,
  );

  onProgress({
    stage: "ready",
    detail: parsed.quality === "estimated"
      ? "A playable estimated score is ready."
      : "The local score is ready to perform.",
    fraction: 1,
    method: parsed.quality === "estimated" ? "fallback" : "neural",
  });

  return {
    id,
    checksum,
    sourceName: files.map((file) => file.name).join(" + "),
    createdAt: new Date().toISOString(),
    metadata: {
      title: parsed.title,
      artist: parsed.artist,
      durationMs,
      language: song.lyricLanguage,
    },
    song,
    warnings: parsed.warnings,
  };
}
