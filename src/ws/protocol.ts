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

// --- History (cmd 1502 / 1503) ---

export interface HistoryItem {
  roundId: string;
  spinId: string;
  transactionId: string;
  spinType: "BASE" | "FREE_SPIN" | "RESPIN";
  stepIndex: number;
  /** Parent round display time (finishedAt / updatedAt). Not exact spin instant. */
  timestampMillis: number;
  /** Only BASE step carries round stake; FREE_SPIN / RESPIN use 0. */
  bet: number;
  win: number;
  profit: number;
}

export interface HistoryListPayload {
  cmd: string | number;
  items: HistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface HistoryWinWay {
  wayIndex: number;
  symbol: string;
  matchCount: number;
  ways: number;
  payout: number;
  /** Reel-major: positions[i] = winning row indices on reel i. */
  positions: number[][];
}

export interface HistoryDetailPayload {
  cmd: string | number;
  roundId: string;
  transactionId: string;
  /** Parent round display time — same semantics as HistoryItem.timestampMillis. */
  finishedAtMillis: number;
  spinId: string;
  /** 0-based index of this spin within its parent round. */
  stepIndex: number;
  /** 1-based step display number. */
  round: number;
  spinType: "BASE" | "FREE_SPIN" | "RESPIN";
  /** Human label: "Normal spin" | "Free spin" | "Respin" */
  title: string;
  /** Only BASE step carries round stake; FREE_SPIN / RESPIN use 0. */
  bet: number;
  win: number;
  profit: number;
  /** Column-major grid, same layout as live spin reels. */
  reels: string[][];
  winWays: HistoryWinWay[];
}
