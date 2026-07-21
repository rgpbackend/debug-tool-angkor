export interface JackpotTierDef {
  /** Identifies the tier in WS payloads (e.g. "NANO", "MINI"). */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Static tiers have a fixed prize = bet × betMultiplier. */
  isStatic: boolean;
  /** Multiplier for static tiers. Ignored for progressive tiers. */
  betMultiplier?: number;
}

export interface GameDef {
  /** gameId for POST /play-game and WS join route. */
  id: string;
  /** Human-readable name shown in the lobby. */
  name: string;
  /** Emoji icon shown in the lobby card. */
  icon: string;
  /** Agent id sent in the WS connect frame. */
  agentId: string;
  /** Jackpot tiers (ordered lowest → highest). */
  jackpotTiers: JackpotTierDef[];
  /** Win evaluation system. */
  winSystem: "winways" | "paylines";
}

const GAMES: GameDef[] = [
  {
    id: "game-the-last-guardian-of-angkor",
    name: "The Last Guardian of Angkor",
    icon: "🏛️",
    agentId: "AGENCY_001",
    winSystem: "winways",
    jackpotTiers: [
      { key: "NANO", label: "NANO", isStatic: true, betMultiplier: 20 },
      { key: "CYBER", label: "CYBER", isStatic: true, betMultiplier: 50 },
      { key: "GUARDIAN", label: "GUARDIAN", isStatic: false },
      { key: "ETERNAL", label: "ETERNAL", isStatic: false },
    ],
  },
  {
    id: "yama_01021",
    name: "Titan's Wrath",
    icon: "⚡",
    agentId: "AGENCY_001",
    winSystem: "paylines",
    jackpotTiers: [
      { key: "MINI", label: "MINI", isStatic: false },
      { key: "MINOR", label: "MINOR", isStatic: false },
      { key: "MAJOR", label: "MAJOR", isStatic: false },
      { key: "GRAND", label: "GRAND", isStatic: false },
    ],
  },
];

export function getGames(): GameDef[] {
  return GAMES;
}
