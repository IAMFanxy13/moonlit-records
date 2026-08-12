import type { SongEvent, SongPackage } from "./song";

function lyricEvents(
  songId: string,
  phraseIndex: number,
  tokens: string[],
  targetCodes: string[],
  notes: string[],
  offset: number,
): SongEvent[] {
  return tokens.map((token, tokenIndex) => ({
    id: `${songId}-${offset + tokenIndex}`,
    phraseIndex,
    tokenIndex,
    token,
    targetCode: targetCodes[tokenIndex],
    note: notes[tokenIndex],
    velocity: 92,
  }));
}

const moonlightEvents = [
  ...lyricEvents(
    "hello-moonlight",
    0,
    ["你", "好", "月", "光"],
    ["KeyN", "KeyH", "KeyY", "KeyG"],
    ["G4", "A4", "C5", "E5"],
    0,
  ),
  ...lyricEvents(
    "hello-moonlight",
    1,
    ["照", "进", "心", "里"],
    ["KeyZ", "KeyJ", "KeyX", "KeyL"],
    ["G5", "E5", "D5", "C5"],
    4,
  ),
];

const twinkleEvents = [
  ...lyricEvents(
    "little-star",
    0,
    ["一", "闪", "一", "闪", "亮", "晶", "晶"],
    ["KeyY", "KeyS", "KeyY", "KeyS", "KeyL", "KeyJ", "KeyJ"],
    ["C4", "C4", "G4", "G4", "A4", "A4", "G4"],
    0,
  ),
  ...lyricEvents(
    "little-star",
    1,
    ["满", "天", "都", "是", "小", "星", "星"],
    ["KeyM", "KeyT", "KeyD", "KeyS", "KeyX", "KeyX", "KeyX"],
    ["F4", "F4", "E4", "E4", "D4", "D4", "C4"],
    7,
  ),
];

const odeEvents = [
  ...lyricEvents(
    "ode-to-joy",
    0,
    ["♪", "♪", "♪", "♪"],
    ["Space", "Space", "Space", "Space"],
    ["E4", "E4", "F4", "G4"],
    0,
  ),
  ...lyricEvents(
    "ode-to-joy",
    1,
    ["♪", "♪", "♪", "♪"],
    ["Space", "Space", "Space", "Space"],
    ["G4", "F4", "E4", "D4"],
    4,
  ),
];

export const builtinSongs: SongPackage[] = [
  {
    id: "hello-moonlight",
    title: "你好，月光",
    artist: "月光唱片 · 原创",
    version: "夜航练习版",
    durationLabel: "00:28",
    recommendedPiano: "warm",
    phrases: [
      { id: "moon-0", text: "你好，月光", startEvent: 0, endEvent: 3 },
      { id: "moon-1", text: "照进心里", startEvent: 4, endEvent: 7 },
    ],
    events: moonlightEvents,
  },
  {
    id: "little-star",
    title: "小星星",
    artist: "佚名",
    version: "公版童谣",
    durationLabel: "00:46",
    recommendedPiano: "bright",
    phrases: [
      { id: "star-0", text: "一闪一闪亮晶晶", startEvent: 0, endEvent: 6 },
      { id: "star-1", text: "满天都是小星星", startEvent: 7, endEvent: 13 },
    ],
    events: twinkleEvents,
  },
  {
    id: "ode-to-joy",
    title: "欢乐颂·片段",
    artist: "贝多芬",
    version: "公版旋律 · 无歌词",
    durationLabel: "00:24",
    recommendedPiano: "concert",
    phrases: [
      { id: "ode-0", text: "♪  无词旋律", startEvent: 0, endEvent: 3 },
      { id: "ode-1", text: "♪  继续呼吸", startEvent: 4, endEvent: 7 },
    ],
    events: odeEvents,
  },
];
