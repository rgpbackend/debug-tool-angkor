type SuperBetToggleProps = { active: boolean; onToggle: () => void; disabled: boolean };

export default function SuperBetToggle({ active, onToggle, disabled }: SuperBetToggleProps) {
  return (
    <button
      className={`titan-superbet-btn${active ? " titan-superbet-btn--on" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      title={active ? "Super Bet ON — +50% bet, double Wild chance" : "Super Bet OFF"}
    >
      Super Bet: {active ? "ON" : "OFF"}
    </button>
  );
}
