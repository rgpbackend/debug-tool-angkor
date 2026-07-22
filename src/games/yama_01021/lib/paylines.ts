export const GRID_REELS = 5;
export const GRID_ROWS = 3;

export type PaylineMatch = {
  paylineIndex: number;
  symbol: string;
  count: number;
  positions: [number, number][];
  direction: "ltr" | "rtl";
};

export type ComboLevel = "none" | "combo" | "super" | "mega";
