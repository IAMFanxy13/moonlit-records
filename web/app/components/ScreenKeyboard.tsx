import { SCREEN_KEYBOARD_ROWS } from "../lib/keyboard";

export interface KeyFeedback {
  code: string;
  kind: "correct" | "wrong" | "free";
}

interface ScreenKeyboardProps {
  targetCode?: string | null;
  targetCodes?: string[];
  feedback: KeyFeedback | null;
  pressedCodes: Set<string>;
}

export function ScreenKeyboard({ targetCode, targetCodes, feedback, pressedCodes }: ScreenKeyboardProps) {
  const targets = new Set(targetCodes ?? (targetCode ? [targetCode] : []));
  return (
    <section className="keyboard-section" aria-label="Computer keyboard piano">
      <div className="keyboard-caption">
        <span>Right-hand lyrics, left-hand harmony — every note still waits for you.</span>
        <span className="reserved-note"><i aria-hidden="true" />A–Z lyric melody · A–Z + Space two hands · Shift instrumental.</span>
      </div>

      <div className="screen-keyboard">
        {SCREEN_KEYBOARD_ROWS.map((row, rowIndex) => (
          <div className={`keyboard-row row-${rowIndex}`} key={`row-${rowIndex}`}>
            {row.map((item) => {
              let state = item.disabled ? "disabled" : "idle";
              if (pressedCodes.has(item.code)) state = "pressed";
              if (feedback?.code === item.code) state = feedback.kind;
              if (targets.has(item.code)) state = "target";

              return (
                <button
                  className="screen-key"
                  data-testid={`key-${item.code}`}
                  data-state={state}
                  disabled={item.disabled}
                  key={item.code}
                  style={{ "--key-width": item.width ?? 1 } as React.CSSProperties}
                  tabIndex={-1}
                  type="button"
                  aria-label={`${item.label}${targets.has(item.code) ? ", target" : " piano key"}`}
                >
                  <span>{item.label}</span>
                  {targets.has(item.code) && <b aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
