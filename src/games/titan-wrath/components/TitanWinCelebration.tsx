import { useEffect, useState } from "react";

type ComboLevel = "COMBO" | "SUPER_COMBO" | "MEGA_COMBO";

interface TitanWinCelebrationProps {
  comboLevel: ComboLevel | null;
}

export default function TitanWinCelebration({ comboLevel }: TitanWinCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ComboLevel | null>(null);

  useEffect(() => {
    if (!comboLevel) {
      setVisible(false);
      return;
    }
    setCurrent(comboLevel);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1500);
    return () => window.clearTimeout(timer);
  }, [comboLevel]);

  if (!visible || !current) return null;

  return (
    <div className="titan-combo-overlay" aria-hidden>
      <span className={`combo-text combo-${current.toLowerCase().replace("_", "-")}`}>
        {current.replace("_", " ")}
      </span>
    </div>
  );
}
