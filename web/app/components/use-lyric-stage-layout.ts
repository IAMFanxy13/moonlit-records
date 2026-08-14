"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const MINIMUM_LYRIC_FONT_PX = 18;
const CHANGE_EPSILON = 0.05;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function sameAnchors(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): boolean {
  if (left.size !== right.size) return false;
  for (const [id, value] of left) {
    const nextValue = right.get(id);
    if (nextValue === undefined || Math.abs(value - nextValue) > CHANGE_EPSILON) return false;
  }
  return true;
}

export interface LyricStageLayout {
  lineRef: RefObject<HTMLDivElement | null>;
  anchorPercentById: ReadonlyMap<string, number>;
}

export function useLyricStageLayout(phraseKey: string): LyricStageLayout {
  const lineRef = useRef<HTMLDivElement>(null);
  const [anchorPercentById, setAnchorPercentById] = useState<ReadonlyMap<string, number>>(new Map());

  useLayoutEffect(() => {
    const line = lineRef.current;
    if (!line) return;

    let disposed = false;
    const measure = () => {
      if (disposed) return;

      line.style.removeProperty("--lyric-fit-font-px");
      const naturalFontPx = Number.parseFloat(window.getComputedStyle(line).fontSize) || 56;
      const availableWidth = line.clientWidth || line.getBoundingClientRect().width;
      const naturalContentWidth = line.scrollWidth;
      const needsFit = availableWidth > 0 && naturalContentWidth > availableWidth;
      const fittedFontPx = needsFit
        ? Math.max(MINIMUM_LYRIC_FONT_PX, naturalFontPx * (availableWidth / naturalContentWidth))
        : naturalFontPx;

      line.style.setProperty("--lyric-fit-font-px", `${Number(fittedFontPx.toFixed(3))}px`);
      line.dataset.fitState = needsFit ? "fitted" : "natural";

      const lineRect = line.getBoundingClientRect();
      const width = lineRect.width || availableWidth;
      if (width <= 0) return;

      const nextAnchors = new Map<string, number>();
      line.querySelectorAll<HTMLElement>("[data-lyric-token-id]").forEach((token) => {
        const id = token.dataset.lyricTokenId;
        if (!id) return;
        const tokenRect = token.getBoundingClientRect();
        const centre = tokenRect.left + tokenRect.width / 2 - lineRect.left;
        nextAnchors.set(id, clampPercent((centre / width) * 100));
      });
      setAnchorPercentById((current) => sameAnchors(current, nextAnchors) ? current : nextAnchors);
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(line);
    void document.fonts?.ready.then(measure);

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [phraseKey]);

  return { lineRef, anchorPercentById };
}
