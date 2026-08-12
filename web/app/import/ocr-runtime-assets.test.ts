import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

describe("bundled OCR runtime", () => {
  test.each([
    ["ocr/PP-OCRv5_mobile_det.tar", 1_000_000],
    ["ocr/PP-OCRv5_mobile_rec.tar", 1_000_000],
    ["ocr/wasm/ort-wasm-simd-threaded.jsep.mjs", 10_000],
    ["ocr/wasm/ort-wasm-simd-threaded.jsep.wasm", 1_000_000],
    ["pdf/pdf.worker.min.mjs", 100_000],
  ])("ships the local recognition asset %s", (filename, minimumBytes) => {
    const asset = resolve(process.cwd(), "public", filename);

    expect(existsSync(asset)).toBe(true);
    expect(statSync(asset).size).toBeGreaterThan(minimumBytes);
  });
});
