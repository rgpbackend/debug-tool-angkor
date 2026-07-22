import { useEffect, useState } from "react";
import { CELEBRATION_DISPLAY_MS, CELEBRATION_EXIT_MS } from "../lib/celebration-timing";
import type { TitanCelebrationItem } from "../lib/celebrations";

type TitanCelebrationOverlayProps = { items: TitanCelebrationItem[]; visible: boolean; resetKey?: string };

export default function TitanCelebrationOverlay({ items, visible, resetKey = "" }: TitanCelebrationOverlayProps) {
  const active = visible && items.length > 0;
  const [phase, setPhase] = useState<"hidden" | "show" | "exit">("hidden");
  const [displayItems, setDisplayItems] = useState<TitanCelebrationItem[]>([]);

  useEffect(() => {
    if (!active) { setPhase("hidden"); setDisplayItems([]); return; }
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setDisplayItems(items); setPhase("show"); } });
    const t1 = window.setTimeout(() => setPhase("exit"), CELEBRATION_DISPLAY_MS);
    const t2 = window.setTimeout(() => setPhase("hidden"), CELEBRATION_DISPLAY_MS + CELEBRATION_EXIT_MS);
    return () => { cancelled = true; window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [active, resetKey, items]);

  if (!active || phase === "hidden") return null;

  return (
    <div className={`titan-celebration-layer${phase === "exit" ? " titan-celebration-layer--out" : ""}`} aria-live="polite">
      <div className="titan-celebration-stack">
        {displayItems.map((item) => (
          <article key={item.id} className={`titan-celebration titan-celebration--${item.kind}`}>
            <span className="titan-celebration-kicker">{item.kind.replace(/_/g, " ")}</span>
            <h4 className="titan-celebration-title">{item.title}</h4>
            {item.detail ? <p className="titan-celebration-detail">{item.detail}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
