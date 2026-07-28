import symbolA from "./symbol-a.png";
import symbolB from "./symbol-b.png";
import symbolC from "./symbol-c.png";
import symbolD from "./symbol-d.png";
import symbolE from "./symbol-e.png";
import symbolF from "./symbol-f.png";
import symbolG from "./symbol-g.png";
import symbolW from "./symbol-w.png";

const SYMBOL_IMAGES: Record<string, string> = {
  A: symbolA,
  B: symbolB,
  C: symbolC,
  D: symbolD,
  E: symbolE,
  F: symbolF,
  G: symbolG,
  W: symbolW,
};

export function getSymbolImage(symbolId: string): string | undefined {
  return SYMBOL_IMAGES[symbolId];
}
