import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { BrowserWsClient } from "../../../ws/browser-ws-client";
import type { GamePhase } from "../../../ws/game-phase";
import type { WsOutboundFrame } from "../../../ws/protocol";

const MAX_ENTRIES = 200;

type Direction = "in" | "out";
type Filter = "all" | "in" | "out" | "error";

type LogEntry = {
  id: number;
  direction: Direction;
  timestamp: number;
  cmd: number | null;
  cmdName: string;
  preview: string;
  payload: unknown;
  isError: boolean;
};

const CMD_NAMES: Record<number, string> = {
  1005: "JOIN",
  1006: "SESSION_TAKEN_OVER",
  1500: "SPIN",
  1501: "BALANCE",
  1502: "JACKPOT",
  1507: "SELECT_FS_MODE",
  1510: "JACKPOT_POOLS",
  1520: "JACKPOT_PUSH",
  1521: "JACKPOT_WINNER",
  1530: "GET_BALANCE",
};

function isHeartbeatFrame(frame: WsOutboundFrame): boolean {
  return frame[0] === "7";
}

function redact(key: string, value: unknown): unknown {
  if (key === "accessToken" || key === "token") return "…";
  return value;
}

function formatPayload(obj: unknown): string {
  try {
    return JSON.stringify(obj, redact, 2);
  } catch {
    return String(obj);
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function cmdNameOf(cmd: number | null, fallback: string): string {
  if (cmd == null) return fallback;
  return CMD_NAMES[cmd] ?? `CMD_${cmd}`;
}

function extractCmd(frame: WsOutboundFrame): number | null {
  const payload = frame[3] as Record<string, unknown> | undefined;
  if (payload?.cmd != null) return Number(payload.cmd);
  const direct = frame[1] as Record<string, unknown> | undefined;
  if (direct?.cmd != null) return Number(direct.cmd);
  return null;
}

function outboundMeta(frame: WsOutboundFrame): {
  cmd: number | null;
  cmdName: string;
  preview: string;
  payload: unknown;
} {
  if (frame[0] === 1) {
    const body =
      frame.length >= 5 && frame[4] !== null && typeof frame[4] === "object"
        ? (frame[4] as Record<string, unknown>)
        : undefined;
    return {
      cmd: null,
      cmdName: "CONNECT",
      preview: body?.reconnect === true ? "reconnect" : "auth",
      payload: frame,
    };
  }
  const cmd = extractCmd(frame);
  const payload = (frame[3] ?? frame[1]) as Record<string, unknown> | undefined;
  const parts: string[] = [];
  if (payload) {
    if (typeof payload.betAmount === "number") parts.push(`bet=${payload.betAmount}`);
    if (typeof payload.mode === "string") parts.push(payload.mode);
  }
  return {
    cmd,
    cmdName: cmdNameOf(cmd, "?"),
    preview: parts.join(" "),
    payload: frame,
  };
}

function gridShape(spin: Record<string, unknown> | undefined): string {
  const grid = spin?.grid ?? spin?.reels;
  if (!Array.isArray(grid)) return "";
  return grid
    .map((col) => (Array.isArray(col) ? col.length : 0))
    .join("×");
}

function inboundPreview(payload: Record<string, unknown>): string {
  const cmd = payload.cmd;
  const c = payload.c;
  const isErr = typeof c === "number" && c !== 0;
  if (isErr) {
    const mgs = typeof payload.mgs === "string" ? payload.mgs : "";
    return `c=${c}${mgs ? ` ${mgs}` : ""}`;
  }
  const parts: string[] = [];
  if (cmd === 1500 || cmd === "1500" || cmd === 1507 || cmd === "1507") {
    const spin = payload.spin as Record<string, unknown> | undefined;
    const shape = gridShape(spin);
    if (shape) parts.push(shape);
    if (spin && typeof spin.winAmount === "number") parts.push(`win=${spin.winAmount}`);
    else if (spin && typeof spin.win === "string") parts.push(`win=${spin.win}`);
    const round = payload.round as Record<string, unknown> | undefined;
    if (typeof round?.state === "string") parts.push(round.state);
    const state = payload.state as Record<string, unknown> | undefined;
    const fs = state?.freeSpin as Record<string, unknown> | undefined;
    if (fs && typeof fs.spinsLeft === "number") parts.push(`fs=${fs.spinsLeft}`);
  }
  if (cmd === 1501 || cmd === "1501") {
    if (typeof payload.balance === "string") parts.push(payload.balance);
  }
  if (cmd === 1005 || cmd === "1005") {
    const symbols = payload.symbols ?? (payload.config as Record<string, unknown> | undefined)?.symbols;
    if (Array.isArray(symbols)) parts.push(`${symbols.length} symbols`);
  }
  if (cmd === 1006 || cmd === "1006") parts.push("session evicted");
  if (cmd === 1530 || cmd === "1530") {
    if (typeof payload.balance === "string") parts.push(payload.balance);
  }
  return parts.join(" ");
}

type WsConsoleProps = {
  clientRef: RefObject<BrowserWsClient | null>;
  phase: GamePhase;
};

export default function WsConsole({ clientRef, phase }: WsConsoleProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const nextIdRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  const pushEntry = useCallback((entry: Omit<LogEntry, "id">) => {
    const id = nextIdRef.current++;
    setEntries((prev) => {
      const next = [...prev, { ...entry, id }];
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    const origIn = client.options.onInbound;
    const origOut = client.options.onOutbound;
    client.options.onInbound = (payload) => {
      if (payload.cmd === undefined || payload.cmd === null) {
        origIn?.(payload);
        return;
      }
      const cmd = Number(payload.cmd);
      const isErr = typeof payload.c === "number" && payload.c !== 0;
      pushEntry({
        direction: "in",
        timestamp: Date.now(),
        cmd: Number.isNaN(cmd) ? null : cmd,
        cmdName: cmdNameOf(Number.isNaN(cmd) ? null : cmd, "IN"),
        preview: inboundPreview(payload),
        payload,
        isError: isErr,
      });
      origIn?.(payload);
    };
    client.options.onOutbound = (frame) => {
      if (!isHeartbeatFrame(frame)) {
        const meta = outboundMeta(frame);
        pushEntry({
          direction: "out",
          timestamp: Date.now(),
          cmd: meta.cmd,
          cmdName: meta.cmdName,
          preview: meta.preview,
          payload: meta.payload,
          isError: false,
        });
      }
      origOut?.(frame);
    };

    const unsubStomp = client.addStompErrorListener((code) => {
      pushEntry({
        direction: "in",
        timestamp: Date.now(),
        cmd: code,
        cmdName: "STOMP",
        preview: `code=${code}`,
        payload: { type: "stomp-error", code },
        isError: true,
      });
    });
    const unsubClose = client.addDisconnectListener((info) => {
      pushEntry({
        direction: "in",
        timestamp: Date.now(),
        cmd: info.code,
        cmdName: "CLOSE",
        preview: `${info.code} ${info.reason}`.trim(),
        payload: info,
        isError: info.code !== 1000,
      });
    });

    return () => {
      client.options.onInbound = origIn;
      client.options.onOutbound = origOut;
      unsubStomp();
      unsubClose();
    };
  }, [clientRef, phase, pushEntry]);

  useEffect(() => {
    if (!autoScroll || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries, autoScroll, filter, query]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 36;
    setAutoScroll(atBottom);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "in" && e.direction !== "in") return false;
      if (filter === "out" && e.direction !== "out") return false;
      if (filter === "error" && !e.isError) return false;
      if (!q) return true;
      return (
        e.cmdName.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q) ||
        String(e.cmd ?? "").includes(q)
      );
    });
  }, [entries, filter, query]);

  const phaseLabel =
    phase === "joined"
      ? "joined"
      : phase === "joining"
        ? "joining"
        : phase === "connecting" || phase === "connected"
          ? "open"
          : phase;

  return (
    <aside className={`bullet-wire${collapsed ? " bullet-wire--collapsed" : ""}`}>
      <button
        type="button"
        className="bullet-wire-toggle"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Show wire" : "Hide wire"}
        aria-expanded={!collapsed}
      >
        {collapsed ? "‹" : "›"}
      </button>

      <header className="bullet-wire-head">
        <div className="bullet-wire-title">
          <span>Wire</span>
          <span className={`bullet-wire-phase bullet-wire-phase--${phase}`}>{phaseLabel}</span>
        </div>
        <button
          type="button"
          className="bullet-wire-clear"
          onClick={() => {
            setEntries([]);
            setExpandedId(null);
          }}
        >
          Clear
        </button>
      </header>

      <div className="bullet-wire-tools">
        <div className="bullet-wire-filters" role="tablist" aria-label="Frame filter">
          {(["all", "in", "out", "error"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`bullet-wire-filter${filter === key ? " bullet-wire-filter--on" : ""}`}
              onClick={() => setFilter(key)}
            >
              {key === "error" ? "Errors" : key === "all" ? "All" : key === "in" ? "In" : "Out"}
            </button>
          ))}
        </div>
        <input
          className="bullet-wire-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter cmd…"
          aria-label="Filter frames"
        />
      </div>

      <div className="bullet-wire-list" ref={listRef} onScroll={handleScroll}>
        {visible.length === 0 ? (
          <p className="bullet-wire-empty">
            {entries.length === 0
              ? "Waiting for frames. Join or spin to fill the wire."
              : "No frames match this filter."}
          </p>
        ) : (
          visible.map((entry) => (
            <div key={entry.id}>
              <button
                type="button"
                className={[
                  "bullet-wire-row",
                  `bullet-wire-row--${entry.direction}`,
                  entry.isError ? "bullet-wire-row--error" : "",
                  expandedId === entry.id ? "bullet-wire-row--open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setExpandedId((prev) => (prev === entry.id ? null : entry.id))}
              >
                <span className="bullet-wire-dir" aria-hidden="true">
                  {entry.direction === "in" ? "◂" : "▸"}
                </span>
                <span className="bullet-wire-time">{formatTime(entry.timestamp)}</span>
                <span className="bullet-wire-summary">
                  {entry.cmdName}
                  {entry.cmd != null ? ` ${entry.cmd}` : ""}
                  {entry.preview ? `  ${entry.preview}` : ""}
                </span>
              </button>
              {expandedId === entry.id ? (
                <pre className="bullet-wire-json">{formatPayload(entry.payload)}</pre>
              ) : null}
            </div>
          ))
        )}
        {!autoScroll && visible.length > 0 ? (
          <button
            type="button"
            className="bullet-wire-latest"
            onClick={() => setAutoScroll(true)}
          >
            Jump to latest
          </button>
        ) : null}
      </div>
    </aside>
  );
}
