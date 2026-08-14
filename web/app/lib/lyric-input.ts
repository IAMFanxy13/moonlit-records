import { pinyin } from "pinyin-pro";

const CHINESE_TOKEN = /^\p{Script=Han}$/u;

export function lyricInitial(token: string): string {
  if (CHINESE_TOKEN.test(token)) {
    return pinyin(token, { pattern: "first", toneType: "none", type: "array" })[0]
      ?.slice(0, 1)
      .toUpperCase() || "A";
  }
  return token.slice(0, 1).toUpperCase() || "A";
}

export function lyricTargetCode(token: string): string {
  return `Key${lyricInitial(token)}`;
}
