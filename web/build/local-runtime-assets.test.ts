import { describe, expect, it } from "vitest";

import { isOcrRuntimeModuleRequest } from "./local-runtime-assets";

describe("local OCR runtime serving", () => {
  it("recognizes Vite's development-time dynamic import request", () => {
    expect(isOcrRuntimeModuleRequest("/ocr/wasm/ort-wasm-simd-threaded.jsep.mjs?import")).toBe(true);
    expect(isOcrRuntimeModuleRequest("/ocr/wasm/ort-wasm-simd-threaded.jsep.mjs?t=123&import")).toBe(true);
  });

  it("does not intercept ordinary runtime assets or unrelated modules", () => {
    expect(isOcrRuntimeModuleRequest("/ocr/wasm/ort-wasm-simd-threaded.jsep.mjs")).toBe(false);
    expect(isOcrRuntimeModuleRequest("/pdf/pdf.worker.min.mjs?import")).toBe(false);
  });
});
