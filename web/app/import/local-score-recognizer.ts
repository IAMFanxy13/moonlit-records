import type { OcrResultItem, PaddleOCR as PaddleOcrInstance } from "@paddleocr/paddleocr-js";

import type { RecognizedScoreLine, RecognizedScorePage, ScoreLineRole } from "./jianpu-types";
import type { LoadedScorePage } from "./score-page-loader";

export interface OcrTextItem {
  poly: [number, number][];
  text: string;
  score: number;
}

export interface LocalScoreRecognizerDependencies {
  preparePage(page: LoadedScorePage): Promise<Blob>;
  recognize(blob: Blob, page: LoadedScorePage): Promise<OcrTextItem[]>;
}

function bounds(item: OcrTextItem) {
  const xs = item.poly.map((point) => point[0]);
  const ys = item.poly.map((point) => point[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { left, top, right, bottom, width: right - left, height: bottom - top, centerY: (top + bottom) / 2 };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 32;
}

function groupIntoLines(items: OcrTextItem[]): OcrTextItem[][] {
  if (items.length === 0) return [];
  const tolerance = Math.max(16, median(items.map((item) => bounds(item).height)) * 0.7);
  const groups: Array<{ centerY: number; items: OcrTextItem[] }> = [];

  [...items]
    .filter((item) => item.text.trim())
    .sort((left, right) => bounds(left).centerY - bounds(right).centerY || bounds(left).left - bounds(right).left)
    .forEach((item) => {
      const centerY = bounds(item).centerY;
      const group = groups.find((candidate) => Math.abs(candidate.centerY - centerY) <= tolerance);
      if (group) {
        group.items.push(item);
        group.centerY = group.items.reduce((sum, entry) => sum + bounds(entry).centerY, 0) / group.items.length;
      } else {
        groups.push({ centerY, items: [item] });
      }
    });

  return groups
    .sort((left, right) => left.centerY - right.centerY)
    .map((group) => group.items.sort((left, right) => bounds(left).left - bounds(right).left));
}

function roleFor(text: string, top: number, height: number): ScoreLineRole {
  const compact = text.replace(/\s+/gu, "");
  const digits = compact.match(/[0-7]/gu) ?? [];
  const otherDigits = compact.match(/[89]/gu) ?? [];
  const scoreHeader = /1\s*=\s*[A-Ga-g]|(?:^|\s)[2-9]\s*\/\s*[24816](?:\s|$)|作[词曲]|词曲/u.test(text);
  const isClockOrCounter = /^\d{1,2}:\d{2}$/u.test(compact) || /^\d+\/\d+$/u.test(compact);
  const notationPunctuationOnly = compact.replace(/[0-7_|｜.·,^\-()⌒]/gu, "");

  if (scoreHeader) return "metadata";
  if (!isClockOrCounter && digits.length >= 2 && otherDigits.length === 0 && notationPunctuationOnly.length === 0) {
    return "notation";
  }
  if (/\p{Script=Han}/u.test(text)) {
    if (top < height * 0.24 && compact.length <= 12) return "title";
    return "lyrics";
  }
  if (/[A-Za-z]{2,}/u.test(text) && !/follow|search|comment|share|like/iu.test(text)) return "lyrics";
  return "unknown";
}

export function classifyOcrResult(
  id: string,
  width: number,
  height: number,
  items: OcrTextItem[],
): RecognizedScorePage {
  const lines: RecognizedScoreLine[] = groupIntoLines(items).map((group) => {
    const text = group.map((item) => item.text.trim()).join(" ").replace(/\s+/gu, " ").trim();
    const top = Math.min(...group.map((item) => bounds(item).top));
    const confidence = group.reduce((sum, item) => sum + item.score, 0) / group.length;
    return { text, top, confidence, role: roleFor(text, top, height) };
  });

  return { id, width, height, lines };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare this score page."));
    }, "image/png");
  });
}

async function defaultPreparePage(page: LoadedScorePage): Promise<Blob> {
  const bitmap = await createImageBitmap(page.blob);
  const smartphoneCapture = page.height / page.width > 1.8;
  const sourceTop = smartphoneCapture ? Math.round(page.height * 0.1) : 0;
  const sourceBottom = smartphoneCapture ? Math.round(page.height * 0.84) : page.height;
  const sourceHeight = Math.max(1, sourceBottom - sourceTop);
  const scale = Math.min(2, 1800 / page.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(page.width * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas image processing is unavailable.");
  context.drawImage(bitmap, 0, sourceTop, page.width, sourceHeight, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const luminance = pixels.data[offset] * 0.299 + pixels.data[offset + 1] * 0.587 + pixels.data[offset + 2] * 0.114;
    const contrasted = luminance < 170 ? Math.max(0, luminance * 0.72) : Math.min(255, 210 + (luminance - 170) * 1.1);
    pixels.data[offset] = contrasted;
    pixels.data[offset + 1] = contrasted;
    pixels.data[offset + 2] = contrasted;
  }
  context.putImageData(pixels, 0, 0);
  return toBlob(canvas);
}

let paddleOcrPromise: Promise<PaddleOcrInstance> | null = null;

async function localPaddleOcr(): Promise<PaddleOcrInstance> {
  if (!paddleOcrPromise) {
    paddleOcrPromise = import("@paddleocr/paddleocr-js").then(({ PaddleOCR }) => PaddleOCR.create({
      textDetectionModelName: "PP-OCRv5_mobile_det",
      textDetectionModelAsset: { url: "/ocr/PP-OCRv5_mobile_det.tar" },
      textRecognitionModelName: "PP-OCRv5_mobile_rec",
      textRecognitionModelAsset: { url: "/ocr/PP-OCRv5_mobile_rec.tar" },
      textDetectionBatchSize: 1,
      textRecognitionBatchSize: 6,
      ortOptions: {
        backend: "wasm",
        wasmPaths: "/ocr/wasm/",
        numThreads: 1,
        simd: true,
      },
    })) as Promise<PaddleOcrInstance>;
  }
  return paddleOcrPromise;
}

async function defaultRecognize(blob: Blob): Promise<OcrTextItem[]> {
  const ocr = await localPaddleOcr();
  const [result] = await ocr.predict(blob, {
    textDetLimitSideLen: 1600,
    textDetLimitType: "max",
    textDetBoxThresh: 0.38,
    textRecScoreThresh: 0.18,
  });
  return (result?.items ?? []).map((item: OcrResultItem) => ({
    poly: item.poly,
    text: item.text,
    score: item.score,
  }));
}

const DEFAULT_DEPENDENCIES: LocalScoreRecognizerDependencies = {
  preparePage: defaultPreparePage,
  recognize: defaultRecognize,
};

export async function recognizeScorePages(
  pages: LoadedScorePage[],
  dependencies: Partial<LocalScoreRecognizerDependencies> = {},
  onPage?: (completed: number, total: number) => void,
): Promise<RecognizedScorePage[]> {
  const runtime = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const results: RecognizedScorePage[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const prepared = await runtime.preparePage(page);
    const items = await runtime.recognize(prepared, page);
    results.push(classifyOcrResult(page.id, page.width, page.height, items));
    onPage?.(index + 1, pages.length);
  }

  return results;
}

