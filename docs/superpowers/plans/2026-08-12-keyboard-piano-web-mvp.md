# 月光唱片 Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个高级、可托管的桌面 Web MVP：用户可搜索内置曲目，选择钢琴后用普通 QWERTY 键盘逐音演奏；当前句与下一句按 KTV 方式显示，按对播放歌曲旋律音并推进，按错播放默认键音、标红但留在当前音，用户可在目标之间自由即兴，结束后生成唱片封套式纪念卡。

**Architecture:** React 负责首页、演奏页和完成页；纯 TypeScript 领域模块负责曲包、物理键映射和演奏状态机，UI 不自行决定音高或推进规则。Tone.js `Sampler` 负责浏览器音频并从本地 Salamander Grand Piano 子集加载采样；通过 `PianoPort` 接口隔离音频实现，使状态机和组件测试不依赖真实声卡。第一阶段只使用内置、人工校验的曲包；后续搜索服务、上传处理和个人曲库通过稳定的 `SongCatalog`/`SongPackage` 边界接入。

**Tech Stack:** React + TypeScript + Vite；Tone.js `Sampler`；Vitest + React Testing Library；Playwright Chromium；CSS 自定义属性与原生 Web Animations/CSS transitions。

## Global Constraints

- 目标平台：Windows 上最新版稳定 Chrome 与 Edge；演奏视口最低 `768px` 宽。
- 手机端小于 `768px` 时不捕获演奏键，只保留搜歌与曲库信息，并显示“演奏需要实体电脑键盘”。
- 不依赖 ROG 灯光、驱动、扩展或桌面客户端。
- 不按键时不得发出钢琴声，也不得自动推进曲目。
- 每次非重复的正确目标键 `keydown` 只消费一个事件；其他可演奏键只发默认音和反馈，不推进歌曲，目标键持续等待。
- 使用 `KeyboardEvent.code`，不使用受输入法、Shift 或大小写影响的 `key`。
- `Escape`、`F1`–`F12`、`Tab`、`CapsLock`、`Enter`、`Backspace`、`Control`、`Alt`、`Meta` 不作为目标键；屏幕键盘将冲突键置灰。
- 演奏区固定展示当前句与下一句；当前字、目标键、下一句和完整屏幕键盘在 `1366×768` 无需页面滚动即可同时看见。
- 视觉固定为“月光唱片”：深夜酒红、暖象牙、低饱和金；不使用持续粒子、廉价霓虹、满屏玻璃卡片或竞技式失败动画。
- 错误使用红色、`×`、轮廓和文字共同表达；不播放额外蜂鸣或惩罚音，按错键的默认钢琴音就是错误听觉反馈。
- 动效尊重 `prefers-reduced-motion`。
- 采样使用 Alexander Holm 的 Salamander Grand Piano V3（CC BY 3.0），在应用关于/鸣谢区域保留作者与许可归属。
- MotionSites 只作为已授权提示词的设计输入；不把它作为运行时依赖，不热链其演示媒体，也不复制未解锁的付费提示词。若后续接入 MotionSites MCP，只用于检索提示词并继续接受本规格与测试约束。

---

## File Structure

```text
index.html                         Vite 入口与中文页面元数据
package.json                       依赖、测试、构建与端到端脚本
vite.config.ts                     React、Vitest/jsdom 配置
playwright.config.ts               本地预览服务与 Chromium 配置
src/main.tsx                       React 挂载入口
src/app/App.tsx                    首页/演奏页/完成页的顶层导航状态
src/app/app.css                    月光唱片设计系统、响应式和动效
src/domain/song.ts                 SongPackage、SongEvent、Phrase 类型
src/domain/keyboard.ts             安全键白名单、默认音与屏幕布局
src/domain/playerMachine.ts        纯函数演奏状态机
src/domain/catalog.ts              内置曲库搜索接口
src/domain/songs.ts                人工校验示例曲包
src/audio/pianoEngine.ts           Tone.Sampler 实现与 PianoPort 接口
src/components/SearchHome.tsx      搜歌首页与曲目卡片
src/components/PlayerShell.tsx     演奏编排、物理键监听、音频触发
src/components/LyricStage.tsx      KTV 当前句/下一句与当前字提示
src/components/ScreenKeyboard.tsx  物理 QWERTY 布局与按键状态
src/components/CompletionCard.tsx  演奏纪念卡与重来/返回操作
src/test/setup.ts                  DOM 测试初始化
src/**/*.test.ts(x)                领域与组件单元测试
e2e/performance.spec.ts            搜歌—演奏—错键—完成闭环
public/audio/salamander/*.mp3      自托管钢琴采样子集
public/audio/ATTRIBUTION.md        采样来源与 CC BY 3.0 归属
```

### Task 1: 建立可测试的 Web 壳与统一曲包

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/test/setup.ts`
- Create: `src/domain/song.ts`
- Create: `src/domain/catalog.ts`
- Create: `src/domain/songs.ts`
- Test: `src/domain/catalog.test.ts`

**Interfaces:**
- Produces: `SongEvent`, `Phrase`, `SongPackage`, `SongCatalog`, `builtinSongs`, `searchSongs(query)`.
- `SongEvent`: `{ id, phraseIndex, tokenIndex, token, targetCode, note, velocity }`.
- `SongPackage`: `{ id, title, artist, version, durationLabel, recommendedPiano, phrases, events }`.

- [ ] **Step 1: 写失败的目录搜索测试**

```ts
import { describe, expect, it } from 'vitest'
import { searchSongs } from './catalog'

describe('searchSongs', () => {
  it('按歌名、歌手和空查询搜索，并返回可演奏状态', () => {
    expect(searchSongs('月光').map(song => song.title)).toContain('你好，月光')
    expect(searchSongs('佚名').length).toBeGreaterThan(0)
    expect(searchSongs('').every(song => song.status === 'ready')).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认因模块不存在而失败**

Run: `pnpm vitest run src/domain/catalog.test.ts`

Expected: FAIL，提示无法解析 `./catalog`。

- [ ] **Step 3: 建立 Vite/React/TypeScript 测试壳并定义曲包**

在 `song.ts` 中定义上述类型；在 `songs.ts` 中提供至少三首人工校验曲包：原创中文示例《你好，月光》（必须包含 `你 → KeyN`、`好 → KeyH`）、公版旋律《小星星》和无歌词空格示例《欢乐颂·片段》。每首至少两句，事件按演奏顺序完整列出。`catalog.ts` 返回 `{ ...song, status: 'ready' as const }`，搜索不区分大小写并匹配歌名、歌手、版本。

- [ ] **Step 4: 运行目录测试与类型检查**

Run: `pnpm vitest run src/domain/catalog.test.ts && pnpm tsc --noEmit`

Expected: PASS，TypeScript 无错误。

- [ ] **Step 5: 提交曲包基础**

```bash
git add package.json index.html tsconfig.json vite.config.ts src
git commit -m "feat: add typed piano song catalog"
```

### Task 2: 键盘白名单与双层演奏状态机

**Files:**
- Create: `src/domain/keyboard.ts`
- Create: `src/domain/keyboard.test.ts`
- Create: `src/domain/playerMachine.ts`
- Create: `src/domain/playerMachine.test.ts`

**Interfaces:**
- Consumes: `SongPackage`, `SongEvent` from `src/domain/song.ts`.
- Produces: `PLAYABLE_CODES`, `KEYBOARD_ROWS`, `defaultNoteFor(code)`, `isPlayableCode(code)`.
- Produces: `PlayerState`, `createPlayerState(song)`, `startPlayer(state)`, `pressKey(state, song, code)`, `togglePause(state)`, `restartPlayer(state)`, `rewindPhrase(state, song)`.
- `pressKey` returns `{ state: PlayerState; sound: { note: string; velocity: number; kind: 'correct' | 'wrong' } | null }`.

- [ ] **Step 1: 写键位与状态机失败测试**

```ts
it('排除浏览器冲突键但保留字母、数字和空格', () => {
  expect(isPlayableCode('KeyN')).toBe(true)
  expect(isPlayableCode('Digit1')).toBe(true)
  expect(isPlayableCode('Space')).toBe(true)
  expect(isPlayableCode('Escape')).toBe(false)
  expect(isPlayableCode('F1')).toBe(false)
  expect(isPlayableCode('Tab')).toBe(false)
})

it('正确键播放歌曲音并推进；错误键播放默认音、记录错误但留在当前事件', () => {
  const song = builtinSongs[0]
  const started = startPlayer(createPlayerState(song))
  const correct = pressKey(started, song, song.events[0].targetCode)
  expect(correct.sound).toMatchObject({ note: song.events[0].note, kind: 'correct' })
  expect(correct.state.eventIndex).toBe(1)

  const wrongCode = song.events[1].targetCode === 'KeyZ' ? 'KeyX' : 'KeyZ'
  const wrong = pressKey(correct.state, song, wrongCode)
  expect(wrong.sound).toMatchObject({ note: defaultNoteFor(wrongCode), kind: 'wrong' })
  expect(wrong.state.eventIndex).toBe(1)
  expect(wrong.state.mistakes).toHaveLength(1)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/domain/keyboard.test.ts src/domain/playerMachine.test.ts`

Expected: FAIL，提示键盘或状态机导出不存在。

- [ ] **Step 3: 实现显式键位表和纯函数状态机**

键位白名单只包含 `Backquote`、`Digit0`–`Digit9`、`Minus`、`Equal`、`KeyA`–`KeyZ`、`BracketLeft`、`BracketRight`、`Backslash`、`Semicolon`、`Quote`、`Comma`、`Period`、`Slash`、`Space`。默认音映射覆盖 `C3`–`C6`；屏幕布局额外包含一行 `Escape/F1–F12`，但标记 `disabled: true`。状态机在 `status !== 'playing'`、不可演奏键或已完成时不消费事件；只有 `code === currentEvent.targetCode` 才推进，最后一个正确目标键后状态变为 `complete`；错误记录 `{ eventIndex, token, pressedCode, expectedCode }`，但 `eventIndex` 保持不变。

- [ ] **Step 4: 补齐长按由 UI 过滤、暂停、重来和回句测试**

```ts
it('暂停不消费事件，恢复后从原位置继续', () => {
  const song = builtinSongs[0]
  const paused = togglePause(startPlayer(createPlayerState(song)))
  expect(pressKey(paused, song, 'KeyN').state.eventIndex).toBe(0)
  expect(togglePause(paused).status).toBe('playing')
})

it('回到当前句时清除该句之后的统计', () => {
  const song = builtinSongs[0]
  const progressed = { ...startPlayer(createPlayerState(song)), eventIndex: song.phrases[1].startEvent + 1 }
  expect(rewindPhrase(progressed, song).eventIndex).toBe(song.phrases[1].startEvent)
})
```

- [ ] **Step 5: 运行全部领域测试并提交**

Run: `pnpm vitest run src/domain`

Expected: PASS。

```bash
git add src/domain
git commit -m "feat: add dual-layer keyboard player machine"
```

### Task 3: 真实钢琴采样音频端口

**Files:**
- Create: `src/audio/pianoEngine.ts`
- Create: `src/audio/pianoEngine.test.ts`
- Create: `public/audio/salamander/A2.mp3`
- Create: `public/audio/salamander/C3.mp3`
- Create: `public/audio/salamander/Ds3.mp3`
- Create: `public/audio/salamander/Fs3.mp3`
- Create: `public/audio/salamander/A3.mp3`
- Create: `public/audio/salamander/C4.mp3`
- Create: `public/audio/salamander/Ds4.mp3`
- Create: `public/audio/salamander/Fs4.mp3`
- Create: `public/audio/salamander/A4.mp3`
- Create: `public/audio/salamander/C5.mp3`
- Create: `public/audio/salamander/Ds5.mp3`
- Create: `public/audio/salamander/Fs5.mp3`
- Create: `public/audio/salamander/A5.mp3`
- Create: `public/audio/salamander/C6.mp3`
- Create: `public/audio/ATTRIBUTION.md`

**Interfaces:**
- Produces: `PianoPort` with `load(): Promise<void>`, `resume(): Promise<void>`, `attack(note, velocity): void`, `release(note): void`, `releaseAll(): void`, `dispose(): void`.
- Produces: `createPianoEngine(): PianoPort` backed by one `Tone.Sampler` and short room reverb.

- [ ] **Step 1: 写音频适配器失败测试**

```ts
it('归一化速度并把音高传给采样器', () => {
  const sampler = { triggerAttack: vi.fn(), triggerRelease: vi.fn(), releaseAll: vi.fn() }
  const port = createPianoEngine({ sampler })
  port.attack('G4', 112)
  expect(sampler.triggerAttack).toHaveBeenCalledWith('G4', undefined, 112 / 127)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/audio/pianoEngine.test.ts`

Expected: FAIL，提示 `createPianoEngine` 不存在。

- [ ] **Step 3: 下载并自托管 Salamander 子集，写明归属**

从 Tone.js 官方示例使用的 Salamander MP3 源取得上列音高；文件名中的升号本地规范化为 `Ds`/`Fs`。`ATTRIBUTION.md` 明确写出 “Salamander Grand Piano V3, Alexander Holm, CC BY 3.0”，并链接原始库与许可证。不得把第三方 CDN 作为运行时唯一来源。

- [ ] **Step 4: 实现采样器、加载状态、释放与测试注入**

使用 `Tone.Sampler({ urls, baseUrl: '/audio/salamander/' })`；只有用户点击“进入演奏”后调用 `resume()`。错误与正确共享同一架钢琴；MVP 的“温暖柔和”通过 `Tone.Filter`、短 `Tone.Reverb` 和采样器包络得到，不伪装成四套真实采样。

- [ ] **Step 5: 运行测试、构建并提交**

Run: `pnpm vitest run src/audio && pnpm build`

Expected: PASS 且生成 `dist/`。

```bash
git add src/audio public/audio package.json pnpm-lock.yaml
git commit -m "feat: add sampled grand piano engine"
```

### Task 4: 高级搜歌首页与进入演奏流程

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/app.css`
- Create: `src/components/SearchHome.tsx`
- Create: `src/components/SearchHome.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `searchSongs`, `SongPackage`.
- Produces: `SearchHome({ onSelect(song) })` and top-level view state `'search' | 'player' | 'complete'`.

- [ ] **Step 1: 写首页失败测试**

```tsx
it('搜索月光并选择可演奏曲目', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(<SearchHome onSelect={onSelect} />)
  await user.type(screen.getByRole('searchbox', { name: '搜索歌曲' }), '月光')
  expect(screen.getByText('你好，月光')).toBeVisible()
  await user.click(screen.getByRole('button', { name: '演奏 你好，月光' }))
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ title: '你好，月光' }))
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/SearchHome.test.tsx`

Expected: FAIL，组件尚不存在。

- [ ] **Step 3: 实现首页结构与月光唱片视觉系统**

首页使用一处大标题、一处主搜索框和最多三张曲目行，不做信息流。CSS 建立酒红背景、象牙文字、金色强调、编辑式衬线标题与无衬线正文；使用渐变光晕但不循环高速运动。每张曲目显示歌名、歌手、版本、时长、“可立即演奏”和推荐钢琴；主操作只有“演奏”。

- [ ] **Step 4: 加入音频加载门槛与可恢复错误文案**

选歌后显示短暂的“为你打开琴盖”加载层；只有 `PianoPort.load()` 成功才出现“进入演奏”。失败时保留“重新加载琴声”和“返回曲库”，不得进入无声播放器。

- [ ] **Step 5: 运行组件测试、键盘可访问性检查并提交**

Run: `pnpm vitest run src/components/SearchHome.test.tsx && pnpm build`

Expected: PASS。

```bash
git add src/app src/components/SearchHome* src/main.tsx
git commit -m "feat: add moonlit song search experience"
```

### Task 5: KTV 上下句、屏幕键盘与完整演奏交互

**Files:**
- Create: `src/components/LyricStage.tsx`
- Create: `src/components/LyricStage.test.tsx`
- Create: `src/components/ScreenKeyboard.tsx`
- Create: `src/components/ScreenKeyboard.test.tsx`
- Create: `src/components/PlayerShell.tsx`
- Create: `src/components/PlayerShell.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

**Interfaces:**
- Consumes: `SongPackage`, `PlayerState`, `PianoPort`, `KEYBOARD_ROWS`, `pressKey`.
- Produces: `PlayerShell({ song, piano, onComplete, onExit })`.
- Produces: visual key states `'disabled' | 'idle' | 'target' | 'pressed' | 'correct' | 'wrong'`.

- [ ] **Step 1: 写 KTV 上下句失败测试**

```tsx
it('同时显示当前句和下一句，并标记当前字与目标键', () => {
  const song = builtinSongs[0]
  render(<LyricStage song={song} eventIndex={0} />)
  expect(screen.getByTestId('current-phrase')).toHaveTextContent(song.phrases[0].text)
  expect(screen.getByTestId('next-phrase')).toHaveTextContent(song.phrases[1].text)
  expect(screen.getByLabelText('当前按键 N')).toBeVisible()
})
```

- [ ] **Step 2: 写正确、错误、长按和暂停的交互失败测试**

```tsx
it('按错标红但保持当前目标；重复 keydown 不推进', () => {
  render(<PlayerShell song={builtinSongs[0]} piano={fakePiano} onComplete={vi.fn()} onExit={vi.fn()} />)
  fireEvent.keyDown(window, { code: 'KeyZ', repeat: false })
  expect(screen.getByTestId('key-KeyZ')).toHaveAttribute('data-state', 'wrong')
  expect(screen.getByTestId('key-KeyN')).toHaveAttribute('data-state', 'target')
  fireEvent.keyDown(window, { code: 'KeyZ', repeat: true })
  expect(screen.getByTestId('progress')).toHaveTextContent('0 /')
})
```

- [ ] **Step 3: 实现 KTV 舞台和屏幕键盘**

当前句逐 token 渲染：已完成为低饱和金，当前字为象牙高亮并带目标键，未来字为柔和灰；下一句完整可见但不逐字着色。屏幕键盘按真实错位和相对键宽绘制；冲突功能键整排置灰并显示“浏览器保留”。视觉只在当前目标、实际按下键和刚发生的反馈上增强。

- [ ] **Step 4: 实现物理键监听与声音/状态顺序**

只在演奏页、页面可见且焦点不在 `input/textarea/select/button/[contenteditable]` 时监听。忽略 `event.repeat`；安全键调用 `preventDefault()`。先根据旧状态取得 `sound`，立即 `piano.attack`，再渲染新状态；`keyup` 调用对应音高的 `release`。页面 `blur` 或 `visibilitychange` 时暂停并 `releaseAll()`。暂停时普通安全键仍播放默认音，但不推进歌曲。

- [ ] **Step 5: 实现换句、回句、重来与反馈计时**

反馈状态保持约 `220ms`；正确反馈出现时状态机立即推进，错误反馈消失后仍回到同一目标。换句使用 `260ms` 淡入淡出且不阻塞按键。顶部操作仅保留暂停/继续、回到本句、重新开始和返回曲库。最后一个正确目标事件消费后调用 `onComplete(finalState)`。

- [ ] **Step 6: 运行组件和领域回归测试并提交**

Run: `pnpm vitest run`

Expected: 所有测试 PASS，无未处理 React `act` 警告。

```bash
git add src/components src/app
git commit -m "feat: add lyric-driven keyboard performance"
```

### Task 6: 纪念卡、响应式与端到端验收

**Files:**
- Create: `src/components/CompletionCard.tsx`
- Create: `src/components/CompletionCard.test.tsx`
- Create: `playwright.config.ts`
- Create: `e2e/performance.spec.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`
- Modify: `package.json`
- Create: `README.md`

**Interfaces:**
- Consumes: final `PlayerState`, `SongPackage`.
- Produces: `CompletionCard({ song, result, onRestart, onHome })`.

- [ ] **Step 1: 写纪念卡与移动端失败测试**

```tsx
it('显示歌曲、日期、正确和错误数，但没有失败措辞', () => {
  render(<CompletionCard song={song} result={result} onRestart={vi.fn()} onHome={vi.fn()} />)
  expect(screen.getByText(song.title)).toBeVisible()
  expect(screen.getByText(`正确 ${result.correctCount}`)).toBeVisible()
  expect(screen.getByText(`错键 ${result.mistakes.length}`)).toBeVisible()
  expect(screen.queryByText(/失败|闯关|生命/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 实现唱片封套式纪念卡**

显示歌名、演奏日期、正确数、错键数与错键歌词位置；操作仅为“再弹一次”“返回曲库”和使用原生 Web Share API（可用时）的“分享纪念”。不可用时复制简短文本到剪贴板，不上传用户结果。

- [ ] **Step 3: 添加端到端闭环测试**

```ts
import { expect, test } from '@playwright/test'
import { builtinSongs } from '../src/domain/songs'

const codeToKeyboardKey = (code: string) => {
  if (code === 'Space') return ' '
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  const symbols: Record<string, string> = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' }
  return symbols[code]
}

test('错误键不推进，随后逐个正确目标键完成演奏', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: '搜索歌曲' }).fill('你好，月光')
  await page.getByRole('button', { name: '演奏 你好，月光' }).click()
  await page.getByRole('button', { name: '进入演奏' }).click()
  await page.keyboard.press('z')
  await expect(page.getByTestId('key-KeyZ')).toHaveAttribute('data-state', 'wrong')
  await expect(page.getByTestId('progress')).toHaveTextContent('0 /')
  for (const event of builtinSongs.find(song => song.title === '你好，月光')!.events) {
    await page.keyboard.press(codeToKeyboardKey(event.targetCode))
  }
  await expect(page.getByRole('heading', { name: '今晚的演奏，留在这里' })).toBeVisible()
})
```

测试环境给音频端口注入无声 fake，避免无声卡或自动播放策略导致不稳定；另加 `360×800` 用例确认屏幕键盘隐藏且移动端提示可见。

- [ ] **Step 4: 做三档视觉与键盘人工验收**

Run: `pnpm build && pnpm preview --host 127.0.0.1`

检查 `1366×768`、`1024×768`、`360×800`：无水平滚动；桌面同时可见当前句、下一句、目标键和键盘；手机无演奏键盘。检查初始、正确、错误、换句、暂停和完成状态；启用系统减少动态后无循环/位移动画。

- [ ] **Step 5: 运行全部验证并修复所有问题**

Run: `pnpm test && pnpm build && pnpm playwright test`

Expected: 单元/组件/端到端测试全部 PASS，生产构建成功。

- [ ] **Step 6: 写明运行方式、样本许可和第二阶段接口并提交**

README 必须包含 `pnpm install`、`pnpm dev`、`pnpm test`、`pnpm build`；说明 MVP 只带人工校验曲包，任意歌名云搜索与音视频自动提取属于下一阶段服务端能力；列出 `SongPackage` 是两阶段共同契约。

```bash
git add README.md package.json playwright.config.ts e2e src
git commit -m "feat: complete moonlit piano web MVP"
```

## Plan Self-Review

- 规格覆盖：搜歌、双层键位、错误键即兴但不推进、长按过滤、暂停、KTV 当前/下一句、冲突键、真实采样、完成卡、手机降级和视觉方向均有对应任务。
- 范围隔离：任意音视频识别、服务端搜索、个人账号与四套真实钢琴采样不混入第一阶段；现有接口允许后续接入。
- 类型一致：所有组件与状态机只依赖 `SongPackage`、`PlayerState`、`PianoPort` 三个稳定边界。
- 无占位符：每项任务都包含明确文件、接口、失败测试、实现规则、验证命令和提交点。
