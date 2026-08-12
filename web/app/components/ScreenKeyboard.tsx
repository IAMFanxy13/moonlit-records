import { KEYBOARD_ROWS } from "../lib/keyboard";

export interface KeyFeedback {
  code: string;
  kind: "correct" | "wrong" | "free";
}

interface ScreenKeyboardProps {
  targetCode: string | null;
  feedback: KeyFeedback | null;
  pressedCodes: Set<string>;
}

export function ScreenKeyboard({ targetCode, feedback, pressedCodes }: ScreenKeyboardProps) {
  return (
    <section className="keyboard-section" aria-label="电脑键盘演奏区">
      <div className="keyboard-caption">
        <span>你的键盘，就是琴键</span>
        <span className="reserved-note"><i aria-hidden="true" />功能键留给浏览器与系统</span>
      </div>

      <div className="screen-keyboard">
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div className={`keyboard-row row-${rowIndex}`} key={`row-${rowIndex}`}>
            {row.map((item) => {
              let state = item.disabled ? "disabled" : "idle";
              if (pressedCodes.has(item.code)) state = "pressed";
              if (item.code === targetCode) state = "target";
              if (feedback?.code === item.code) state = feedback.kind;

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
                  aria-label={`${item.label}${item.disabled ? "，不可用于演奏" : "键"}`}
                >
                  <span>{item.label}</span>
                  {item.code === targetCode && <b aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
