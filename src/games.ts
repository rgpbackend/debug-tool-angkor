export interface GameDef {
  /** gameId for POST /play-game and WS join route. */
  id: string;
  /** Human-readable name shown in the lobby. */
  name: string;
  /** Emoji icon shown in the lobby card. */
  icon: string;
  /** Agent id sent in the WS connect frame. */
  agentId: string;
}

const GAMES: GameDef[] = [
  {
    id: "game-the-last-guardian-of-angkor",
    name: "The Last Guardian of Angkor",
    icon: "🏛️",
    agentId: "AGENCY_001",
  },
  {
    id: "yama_01021",
    name: "Titan's Wrath",
    icon: "⚡",
    agentId: "AGENCY_001",
  },
];

export function getGames(): GameDef[] {
  return GAMES;
}
