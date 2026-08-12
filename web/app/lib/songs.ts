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
    notes: [notes[tokenIndex]],
    note: notes[tokenIndex],
    velocity: 92,
    kind: "tap" as const,
    confidence: 1,
    provenance: ["curated"],
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
  ...lyricEvents(
    "little-star",
    2,
    ["挂", "在", "天", "上", "放", "光", "明"],
    ["KeyG", "KeyZ", "KeyT", "KeyS", "KeyF", "KeyG", "KeyM"],
    ["G4", "G4", "F4", "F4", "E4", "E4", "D4"],
    14,
  ),
  ...lyricEvents(
    "little-star",
    3,
    ["好", "像", "许", "多", "小", "眼", "睛"],
    ["KeyH", "KeyX", "KeyX", "KeyD", "KeyX", "KeyY", "KeyJ"],
    ["G4", "G4", "F4", "F4", "E4", "E4", "D4"],
    21,
  ),
  ...lyricEvents(
    "little-star",
    4,
    ["一", "闪", "一", "闪", "亮", "晶", "晶"],
    ["KeyY", "KeyS", "KeyY", "KeyS", "KeyL", "KeyJ", "KeyJ"],
    ["C4", "C4", "G4", "G4", "A4", "A4", "G4"],
    28,
  ),
  ...lyricEvents(
    "little-star",
    5,
    ["满", "天", "都", "是", "小", "星", "星"],
    ["KeyM", "KeyT", "KeyD", "KeyS", "KeyX", "KeyX", "KeyX"],
    ["F4", "F4", "E4", "E4", "D4", "D4", "C4"],
    35,
  ),
];

const odeNotes = ["E4", "E4", "F4", "G4", "G4", "F4", "E4", "D4"];
const odeTargets = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8"];
const odeEvents: SongEvent[] = odeNotes.map((note, index) => ({
  id: `ode-to-joy-${index}`,
  phraseIndex: index < 4 ? 0 : 1,
  tokenIndex: null,
  token: null,
  targetCode: odeTargets[index],
  notes: [note],
  note,
  velocity: 92,
  kind: "tap",
  confidence: 1,
  provenance: ["curated"],
}));

export const builtinSongs: SongPackage[] = [
  {
    id: "hello-moonlight",
    title: "Hello, Moonlight",
    artist: "Moonlit Records · Original",
    version: "Night Passage Study",
    searchAliases: ["你好月光", "你好，月光", "月光", "原创", "夜航练习版"],
    lyricLanguage: "zh-CN",
    durationLabel: "00:28",
    recommendedPiano: "warm",
    quality: "clear",
    provenance: ["curated"],
    phrases: [
      { id: "moon-0", text: "你好，月光", startEvent: 0, endEvent: 3 },
      { id: "moon-1", text: "照进心里", startEvent: 4, endEvent: 7 },
    ],
    events: moonlightEvents,
  },
  {
    id: "little-star",
    title: "Twinkle, Twinkle, Little Star",
    artist: "Traditional · Anonymous",
    version: "Public-domain Lullaby",
    searchAliases: ["小星星", "一闪一闪亮晶晶", "佚名", "童谣"],
    lyricLanguage: "zh-CN",
    durationLabel: "01:12",
    recommendedPiano: "bright",
    quality: "clear",
    provenance: ["public-domain-melody", "curated"],
    phrases: [
      { id: "star-0", text: "一闪一闪亮晶晶", startEvent: 0, endEvent: 6 },
      { id: "star-1", text: "满天都是小星星", startEvent: 7, endEvent: 13 },
      { id: "star-2", text: "挂在天上放光明", startEvent: 14, endEvent: 20 },
      { id: "star-3", text: "好像许多小眼睛", startEvent: 21, endEvent: 27 },
      { id: "star-4", text: "一闪一闪亮晶晶", startEvent: 28, endEvent: 34 },
      { id: "star-5", text: "满天都是小星星", startEvent: 35, endEvent: 41 },
    ],
    events: twinkleEvents,
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy · Excerpt",
    artist: "Ludwig van Beethoven",
    version: "Public-domain Melody · Instrumental",
    searchAliases: ["欢乐颂", "贝多芬", "片段", "无歌词"],
    lyricLanguage: "zh-CN",
    durationLabel: "00:24",
    recommendedPiano: "concert",
    quality: "clear",
    provenance: ["public-domain-melody", "curated"],
    phrases: [
      { id: "ode-0", text: "♪  无词旋律", startEvent: 0, endEvent: 3 },
      { id: "ode-1", text: "♪  继续呼吸", startEvent: 4, endEvent: 7 },
    ],
    events: odeEvents,
  },
];
