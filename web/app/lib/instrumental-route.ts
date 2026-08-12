const DIGIT_ROUTE = [
  "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
  "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
  "Digit0", "Digit9", "Digit8", "Digit7", "Digit6",
  "Digit5", "Digit4", "Digit3", "Digit2", "Digit1",
] as const;

export function instrumentalTarget(index: number): string {
  const normalized = ((index % DIGIT_ROUTE.length) + DIGIT_ROUTE.length) % DIGIT_ROUTE.length;
  return DIGIT_ROUTE[normalized];
}
