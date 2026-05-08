export type WsFrame2 = [number, Record<string, unknown>];
export type WsFrame4 = [number, string, string, Record<string, unknown>];
export type WsFrame5 = [
  number,
  string,
  string,
  string,
  Record<string, unknown>,
];
export type WsFrame = WsFrame2 | WsFrame4 | WsFrame5;
export type HeartbeatFrame = [string, string, string, number];
export type WsOutboundFrame = WsFrame | HeartbeatFrame;

export function getFramePayload(frame: WsFrame): Record<string, unknown> {
  return frame.at(-1) as Record<string, unknown>;
}

export function hasCmd(
  payload: Record<string, unknown>,
  expected: string,
): boolean {
  const cmd = payload.cmd;
  return cmd === expected || cmd === Number(expected);
}

export interface SpinResponsePayload {
  spin: {
    spinId: string;
    spinType: string;
    reels: string[][];
    win: number;
    triggers: string[];
    winWays?: WinWay[];
    guardianWild?: any;
    retrigger: {
      triggered: boolean;
      scatterCount: number;
      addedFreeSpins: number;
      scatterPositions: [number, number][];
    };
    jackpot: {
      triggered: boolean;
      tier: string | null;
      jackpotWin: number;
      goldenWildPositions: [number, number][];
    };
  };
  round: {
    roundId: string;
    state: string;
    bet: number;
    totalWin: number;
    isFinished: boolean;
  };
  state: {
    freeSpin: {
      active: boolean;
      spinsLeft: number;
      scatterCollected: number;
      triggeredScatterCount: number;
      currentStep: number;
      totalSteps: number;
    };
    respin: {
      active: boolean;
      origin: string;
      currentStep: number;
      totalSteps: number;
      stickyWildExpansionSteps: Record<string, number>;
      stickyWildAnchorRows: Record<string, number>;
    };
  };
}

export interface WinWay {
  symbol: string;
  matchCount: number;
  ways: number;
  payout: number;
  positions: number[][];
}
