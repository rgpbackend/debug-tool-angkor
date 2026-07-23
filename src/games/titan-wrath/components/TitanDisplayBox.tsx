import { useEffect, useState } from "react";

interface TitanDisplayBoxProps {
  spinning: boolean;
  totalWin: number | null;
}

const USP_MESSAGES = ["Win up to 2100x Bet", "Good luck"];

export default function TitanDisplayBox({ spinning, totalWin }: TitanDisplayBoxProps) {
  const [uspIndex, setUspIndex] = useState(0);

  useEffect(() => {
    if (spinning || totalWin !== null) return;
    const timer = window.setInterval(() => {
      setUspIndex((i) => (i + 1) % USP_MESSAGES.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [spinning, totalWin]);

  const showWin = !spinning && totalWin !== null && totalWin > 0;

  return (
    <div className={`titan-display-box${showWin ? " display-win" : ""}`}>
      {showWin ? (
        <span className="titan-win-amount" key={totalWin}>
          ${totalWin.toFixed(2)}
        </span>
      ) : (
        <span className="titan-usp-text">
          {USP_MESSAGES[uspIndex]}
        </span>
      )}
    </div>
  );
}
