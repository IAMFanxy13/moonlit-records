import { ImportScoreError } from "./types";

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

export interface DecodedScoreImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface LoadedScorePage extends DecodedScoreImage {
  id: string;
  sourceName: string;
  sourceIndex: number;
  pageNumber: number;
}

export interface ScorePageLoaderDependencies {
  decodeImage(file: File): Promise<DecodedScoreImage>;
  renderPdf(file: File): Promise<DecodedScoreImage[]>;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ImportScoreError("UNSUPPORTED_SCORE", "This PDF page could not be rendered."));
    }, "image/png");
  });
}

async function defaultDecodeImage(file: File): Promise<DecodedScoreImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const result = { blob: file, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ blob: file, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImportScoreError("UNSUPPORTED_SCORE", `Could not decode ${file.name}.`));
    };
    image.src = objectUrl;
  });
}

async function defaultRenderPdf(file: File): Promise<DecodedScoreImage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: DecodedScoreImage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new ImportScoreError("UNSUPPORTED_SCORE", "Canvas rendering is unavailable.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push({ blob: await canvasBlob(canvas), width: canvas.width, height: canvas.height });
  }

  return pages;
}

const DEFAULT_DEPENDENCIES: ScorePageLoaderDependencies = {
  decodeImage: defaultDecodeImage,
  renderPdf: defaultRenderPdf,
};

export async function loadScorePages(
  files: File[],
  dependencies: Partial<ScorePageLoaderDependencies> = {},
): Promise<LoadedScorePage[]> {
  if (files.length === 0) {
    throw new ImportScoreError("NO_SCORE_PAGES", "Choose at least one score image or PDF.");
  }
  if (files.length > 20) {
    throw new ImportScoreError("PAGE_LIMIT", "Choose no more than 20 score files at once.");
  }

  const runtime = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const loaded: LoadedScorePage[] = [];

  for (let sourceIndex = 0; sourceIndex < files.length; sourceIndex += 1) {
    const file = files[sourceIndex];
    if (!ACCEPTED_TYPES.has(file.type)) {
      throw new ImportScoreError(
        "UNSUPPORTED_SCORE",
        `${file.name} is not a PNG, JPEG, WebP, or PDF score.`,
      );
    }
    if (file.size > 40 * 1024 * 1024) {
      throw new ImportScoreError("FILE_TOO_LARGE", `${file.name} is larger than 40 MB.`);
    }

    const decoded = file.type === "application/pdf"
      ? await runtime.renderPdf(file)
      : [await runtime.decodeImage(file)];
    decoded.forEach((page, pageIndex) => {
      loaded.push({
        ...page,
        id: `source-${sourceIndex + 1}-page-${pageIndex + 1}`,
        sourceName: file.name,
        sourceIndex,
        pageNumber: pageIndex + 1,
      });
    });
  }

  if (loaded.length === 0) {
    throw new ImportScoreError("NO_SCORE_PAGES", "No readable score pages were found.");
  }
  return loaded;
}

