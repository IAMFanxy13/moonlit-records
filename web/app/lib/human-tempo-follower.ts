export interface TempoObservation {
  actualAtMs: number;
  scoreOnsetMs: number;
  hasRest?: boolean;
  interrupted?: boolean;
}

export interface HumanTempoFollower {
  observe(observation: TempoObservation): number;
  scale(): number;
  reset(): void;
}

export const MIN_PERFORMANCE_SCALE = 0.82;
export const MAX_PERFORMANCE_SCALE = 1.75;
const MAX_IDLE_MS = 4_000;
const MIN_RATIO = 0.55;
const MAX_RATIO = 2.4;
const FIRST_INTERVAL_MAX = 1.12;
const SECOND_INTERVAL_MAX = 1.3;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function createHumanTempoFollower(): HumanTempoFollower {
  let recentRatios: number[] = [];
  let currentScale = 1;
  let previous: TempoObservation | null = null;

  return {
    observe(observation) {
      if (observation.interrupted || observation.hasRest) {
        previous = null;
        return currentScale;
      }
      if (!previous) {
        previous = observation;
        return currentScale;
      }

      const actualDelta = observation.actualAtMs - previous.actualAtMs;
      const scoreDelta = observation.scoreOnsetMs - previous.scoreOnsetMs;
      previous = observation;
      if (actualDelta <= 0 || scoreDelta <= 0 || actualDelta > MAX_IDLE_MS) return currentScale;

      const ratio = actualDelta / scoreDelta;
      if (!Number.isFinite(ratio) || ratio < MIN_RATIO || ratio > MAX_RATIO) return currentScale;
      recentRatios = [...recentRatios.slice(-4), ratio];
      const confidenceMaximum = recentRatios.length === 1
        ? FIRST_INTERVAL_MAX
        : recentRatios.length === 2
          ? SECOND_INTERVAL_MAX
          : MAX_PERFORMANCE_SCALE;
      const robustRatio = clamp(
        median(recentRatios),
        MIN_PERFORMANCE_SCALE,
        confidenceMaximum,
      );
      const smoothing = robustRatio > currentScale ? 0.55 : 0.25;
      currentScale = clamp(
        currentScale * (1 - smoothing) + robustRatio * smoothing,
        MIN_PERFORMANCE_SCALE,
        MAX_PERFORMANCE_SCALE,
      );
      if (Math.abs(currentScale - MIN_PERFORMANCE_SCALE) < 0.005) {
        currentScale = MIN_PERFORMANCE_SCALE;
      }
      if (Math.abs(currentScale - MAX_PERFORMANCE_SCALE) < 0.005) {
        currentScale = MAX_PERFORMANCE_SCALE;
      }
      return currentScale;
    },
    scale() {
      return currentScale;
    },
    reset() {
      recentRatios = [];
      currentScale = 1;
      previous = null;
    },
  };
}
