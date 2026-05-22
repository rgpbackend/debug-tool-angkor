import { useEffect, useState, type CSSProperties } from "react";
import {
  CELEBRATION_DISPLAY_MS,
  CELEBRATION_EXIT_MS,
} from "../lib/celebration-timing";
import type { CelebrationItem } from "../lib/spin-celebrations";

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
  const active = visible && items.length > 0;
  const [phase, setPhase] = useState<Phase>("hidden");
  const [displayItems, setDisplayItems] = useState<CelebrationItem[]>([]);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => {
        setPhase("hidden");
        setDisplayItems([]);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setDisplayItems(items);
      setPhase("show");
    });

    const exitTimer = window.setTimeout(
      () => setPhase("exit"),
      CELEBRATION_DISPLAY_MS,
    );
    const hideTimer = window.setTimeout(
      () => setPhase("hidden"),
      CELEBRATION_DISPLAY_MS + CELEBRATION_EXIT_MS,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [active, resetKey, items]);

  if (!active || phase === "hidden") {
    return null;
  }

  return (
    <div
      className={`slot-celebration-layer${phase === "exit" ? " slot-celebration-layer--out" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="slot-celebration-stack">
        {displayItems.map((item, index) => (
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
