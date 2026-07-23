import type { ComponentType } from "react";
import { GameScreen as AngkorGameScreen } from "./games/game-the-last-guardian-of-angkor";

export interface JackpotTierDef {
  key: string;
  label: string;
  isStatic: boolean;
  betMultiplier?: number;
}

export type GameScreenProps = {
  agencyUserToken: string;
  wsAccessToken: string;
  balance?: string | null;
  depositBusy?: boolean;
  depositFunds?: () => Promise<void>;
  onBackToLobby: () => void;
  onLogout: () => void;
};

export interface GameDef {
  id: string;
  name: string;
  icon: string;
  agentId: string;
  jackpotTiers: JackpotTierDef[];
  winSystem: "winways" | "paylines";
  GameScreen: ComponentType<GameScreenProps>;
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
    GameScreen: AngkorGameScreen,
  },
  // Add new games here — same GameDef shape.
];

export function getGames(): GameDef[] {
  return GAMES;
}
