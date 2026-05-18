import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CelebrationItem } from "../lib/spin-celebrations";

const DISPLAY_MS = 1000;
const EXIT_MS = 280;

export type SlotCelebrationOverlayProps = {
  items: CelebrationItem[];
  visible: boolean;
  /** Changes when a new spin result should replay celebrations. */
  resetKey?: string;
};

const KIND_LABEL: Record<CelebrationItem["kind"], string> = {
  jackpot: "Jackpot",
  free_spin: "Free spin",
  retrigger: "Retrigger",
  guardian_wild: "Guardian",
  respin: "Respin",
  win: "Win",
};

type Phase = "hidden" | "show" | "exit";

export default function SlotCelebrationOverlay({
  items,
  visible,
  resetKey = "",
}: Readonly<SlotCelebrationOverlayProps>) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const shownItemsRef = useRef<CelebrationItem[]>([]);

  useEffect(() => {
    if (!visible || items.length === 0) {
      setPhase("hidden");
      return;
    }

    shownItemsRef.current = items;
    setPhase("show");

    const exitTimer = window.setTimeout(() => setPhase("exit"), DISPLAY_MS);
    const hideTimer = window.setTimeout(
      () => setPhase("hidden"),
      DISPLAY_MS + EXIT_MS,
    );

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [visible, resetKey, items]);

  if (phase === "hidden") {
    return null;
  }

  const shownItems = shownItemsRef.current;

  return (
    <div
      className={`slot-celebration-layer${phase === "exit" ? " slot-celebration-layer--out" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="slot-celebration-stack">
        {shownItems.map((item, index) => (
          <article
            key={item.id}
            className={`slot-celebration slot-celebration--${item.kind}`}
            style={
              { "--celebrate-delay": `${index * 90}ms` } as CSSProperties
            }
          >
            <span className="slot-celebration-kicker">
              {KIND_LABEL[item.kind]}
            </span>
            <h4 className="slot-celebration-title">{item.title}</h4>
            {item.detail ? (
              <p className="slot-celebration-detail">{item.detail}</p>
            ) : null}
            <span className="slot-celebration-spark" aria-hidden />
          </article>
        ))}
      </div>
    </div>
  );
}
