import { inactiveAlchemyFever, type AlchemyFever } from "../alchemy-protocol";

type FeverMeterProps = {
  fever: AlchemyFever | null;
  goldenMultiplier: string | null;
};

function factorLabel(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return Number.isInteger(n) ? String(n) : String(n);
}

export default function FeverMeter({ fever, goldenMultiplier }: FeverMeterProps) {
  const meter = fever ?? inactiveAlchemyFever();
  const progress =
    meter.target == null ? String(meter.collected) : `${meter.collected}/${meter.target}`;
  const level = meter.active && meter.level > 0 ? String(meter.level) : "–";
  const multiplier = meter.active ? `×${factorLabel(meter.multiplier)}` : "×–";
  const spot =
    goldenMultiplier && factorLabel(goldenMultiplier) !== "1"
      ? `spot ×${factorLabel(goldenMultiplier)}`
      : "";
  const extras = [
    meter.clearLowSymbols !== "INACTIVE" ? meter.clearLowSymbols : "",
    meter.doubleWild ? "double wild" : "",
    spot,
  ].filter(Boolean);

  return (
    <div className={`alchemy-fever${meter.active ? " alchemy-fever--on" : ""}`}>
      <span className="alchemy-fever-name">Gold Fever</span>
      <span className="alchemy-fever-progress">{progress}</span>
      <span>LV {level}</span>
      <span>{multiplier}</span>
      {extras.length > 0 ? <span className="alchemy-fever-extra">{extras.join(" · ")}</span> : null}
    </div>
  );
}
