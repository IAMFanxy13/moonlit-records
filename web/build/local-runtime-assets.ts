import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Plugin } from "vite";

const OCR_MODULE_PATH = "/ocr/wasm/ort-wasm-simd-threaded.jsep.mjs";

export function isOcrRuntimeModuleRequest(requestUrl: string): boolean {
  const url = new URL(requestUrl, "http://localhost");
  return url.pathname === OCR_MODULE_PATH && url.searchParams.has("import");
}

/**
 * Vite reserves `?import` for source modules and otherwise rejects matching
 * files from public/. ONNX Runtime uses that URL during a development build,
 * so serve this one bundled module before Vite's public-file guard runs.
 */
export function localRuntimeAssets(): Plugin {
  return {
    name: "local-ocr-runtime-assets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url || !isOcrRuntimeModuleRequest(request.url)) {
          next();
          return;
        }

        try {
          const modulePath = resolve(
            process.cwd(),
            "public",
            "ocr",
            "wasm",
            "ort-wasm-simd-threaded.jsep.mjs",
          );
          const source = await readFile(modulePath);
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/javascript; charset=utf-8");
          response.setHeader("Cache-Control", "no-cache");
          response.end(source);
        } catch (error) {
          next(error as Error);
        }
      });
    },
  };
}
