import { formatAlchemyMoney } from "../lib/format";
import type { AlchemyTickerEntry } from "../lib/tumble";

type WinTickerProps = {
  entries: AlchemyTickerEntry[];
};

export default function WinTicker({ entries }: WinTickerProps) {
  return (
    <div className="alchemy-ticker" aria-live="polite">
      {entries.length === 0 ? (
        <p className="alchemy-ticker-empty"> </p>
      ) : (
        <ul className="alchemy-ticker-list">
          {entries.map((entry) => (
              <li key={entry.id} className="alchemy-ticker-row">
                <span className="alchemy-ticker-count">{entry.count}</span>
                <span className="alchemy-ticker-id">{entry.symbol}</span>
                <span className="alchemy-ticker-win">{formatAlchemyMoney(entry.winAmount)}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
