import type { PianoRuntimeInfo } from "./piano-engine";

export interface PerformanceDiagnosticSnapshot {
  activePhysicalVoices: number;
  activeResonanceVoices: number;
  runtime: PianoRuntimeInfo;
}

export interface PerformanceTimingRecord {
  code: string;
  keyDownAt: number;
  keyUpAt?: number;
  attackCalledAt?: number;
  holdMs?: number;
  interKeyGapMs?: number;
  keyDownToAttackMs?: number;
  contextState: string;
  baseLatency: number | null;
  latencyHint: string | number | null;
  outputLatency?: number | null;
  outputTimestamp?: { contextTime?: number; performanceTime?: number } | null;
  currentTime?: number | null;
  lookAhead?: number | null;
  activePhysicalVoices: number;
  activeResonanceVoices: number;
}

type DiagnosticPhase = "keydown" | "attack" | "keyup";

interface DiagnosticOptions {
  enabled: boolean;
  sink?: (phase: DiagnosticPhase, record: PerformanceTimingRecord) => void;
}

function applySnapshot(
  record: PerformanceTimingRecord,
  snapshot: PerformanceDiagnosticSnapshot,
): void {
  record.contextState = snapshot.runtime.state;
  record.baseLatency = snapshot.runtime.baseLatency;
  record.latencyHint = snapshot.runtime.latencyHint;
  record.outputLatency = snapshot.runtime.outputLatency;
  record.outputTimestamp = snapshot.runtime.outputTimestamp;
  record.currentTime = snapshot.runtime.currentTime;
  record.lookAhead = snapshot.runtime.lookAhead;
  record.activePhysicalVoices = snapshot.activePhysicalVoices;
  record.activeResonanceVoices = snapshot.activeResonanceVoices;
}

export function createPerformanceDiagnostics(options: DiagnosticOptions) {
  const entries: PerformanceTimingRecord[] = [];
  const active = new Map<string, number>();
  let lastKeyUpAt: number | null = null;
  const sink = options.sink ?? ((phase: DiagnosticPhase, record: PerformanceTimingRecord) => {
    console.debug(`[Moonlit audio:${phase}] ${JSON.stringify(record)}`);
  });

  const emit = (phase: DiagnosticPhase, record: PerformanceTimingRecord) => {
    if (options.enabled) sink(phase, { ...record });
  };

  return {
    keyDown(code: string, now: number, snapshot: PerformanceDiagnosticSnapshot) {
      if (!options.enabled) return;
      const record: PerformanceTimingRecord = {
        code,
        keyDownAt: now,
        interKeyGapMs: lastKeyUpAt === null ? undefined : Math.max(0, now - lastKeyUpAt),
        contextState: snapshot.runtime.state,
        baseLatency: snapshot.runtime.baseLatency,
        latencyHint: snapshot.runtime.latencyHint,
        outputLatency: snapshot.runtime.outputLatency,
        outputTimestamp: snapshot.runtime.outputTimestamp,
        currentTime: snapshot.runtime.currentTime,
        lookAhead: snapshot.runtime.lookAhead,
        activePhysicalVoices: snapshot.activePhysicalVoices,
        activeResonanceVoices: snapshot.activeResonanceVoices,
      };
      entries.push(record);
      active.set(code, entries.length - 1);
      emit("keydown", record);
    },
    audioAttack(code: string, now: number, snapshot: PerformanceDiagnosticSnapshot) {
      if (!options.enabled) return;
      const index = active.get(code);
      if (index === undefined) return;
      const record = entries[index];
      record.attackCalledAt = now;
      record.keyDownToAttackMs = Math.max(0, now - record.keyDownAt);
      applySnapshot(record, snapshot);
      emit("attack", record);
    },
    keyUp(code: string, now: number, snapshot: PerformanceDiagnosticSnapshot) {
      if (!options.enabled) return;
      const index = active.get(code);
      if (index === undefined) return;
      const record = entries[index];
      record.keyUpAt = now;
      record.holdMs = Math.max(0, now - record.keyDownAt);
      applySnapshot(record, snapshot);
      active.delete(code);
      lastKeyUpAt = now;
      emit("keyup", record);
    },
    records(): PerformanceTimingRecord[] {
      return entries.map((entry) => ({ ...entry }));
    },
  };
}

export type PerformanceDiagnostics = ReturnType<typeof createPerformanceDiagnostics>;
