import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BrowserWsClient } from "../../../ws/browser-ws-client";
import type { GamePhase } from "../../../ws/game-phase";
import type { WsOutboundFrame } from "../../../ws/protocol";

const MAX_ENTRIES = 80;

type Direction = "in" | "out";

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
  return null;
}

function outboundMeta(frame: WsOutboundFrame): {
  cmd: number | null;
  cmdName: string;
  preview: string;
  payload: unknown;
} {
  if (frame[0] === 1) {
    return { cmd: null, cmdName: "CONNECT", preview: "auth", payload: frame };
  }
  const cmd = extractCmd(frame);
  const payload = frame[3] as Record<string, unknown> | undefined;
  const parts: string[] = [];
  if (payload) {
    if (typeof payload.betAmount === "number") parts.push(`bet=${payload.betAmount}`);
    if (typeof payload.roundId === "string") parts.push(`round=${payload.roundId.slice(0, 8)}`);
    if (typeof payload.step === "number") parts.push(`step=${payload.step}`);
  }
  return {
    cmd,
    cmdName: cmdNameOf(cmd, "?"),
    preview: parts.join(" "),
    payload: frame,
  };
}

function inboundPreview(payload: Record<string, unknown>): string {
  const cmd = payload.cmd;
  const c = payload.c;
  const isErr = typeof c === "number" && c !== 0;
  if (isErr) {
    const mgs = typeof payload.mgs === "string" ? payload.mgs : "";
    const msg = typeof payload.msg === "string" ? payload.msg : "";
    return `c=${c}${mgs || msg ? ` ${mgs || msg}` : ""}`;
  }
  const parts: string[] = [];
  if (cmd === 1500 || cmd === "1500") {
    const spin = payload.spin as Record<string, unknown> | undefined;
    const state = payload.state as Record<string, unknown> | undefined;
    if (typeof spin?.spinType === "string") parts.push(spin.spinType);
    if (typeof spin?.spinIndex === "number") parts.push(`#${spin.spinIndex}`);
    if (typeof spin?.winAmount === "string") parts.push(`win=${spin.winAmount}`);
    if (typeof state?.nextAction === "string") parts.push(state.nextAction);
  }
  if (cmd === 1501 || cmd === "1501") {
    if (typeof payload.balance === "string") parts.push(payload.balance);
  }
  if (cmd === 1005 || cmd === "1005") {
    const symbols = payload.symbols;
    if (Array.isArray(symbols)) parts.push(`${symbols.length} symbols`);
  }
  return parts.join(" ");
}

type PayloadInspectorProps = {
  clientRef: RefObject<BrowserWsClient | null>;
  phase: GamePhase;
  headerExtra?: ReactNode;
};

export default function PayloadInspector({ clientRef, phase, headerExtra }: PayloadInspectorProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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

    return () => {
      client.options.onInbound = origIn;
      client.options.onOutbound = origOut;
    };
  }, [clientRef, phase, pushEntry]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries]);

  const phaseLabel =
    phase === "joined"
      ? "joined"
      : phase === "joining"
        ? "joining"
        : phase === "connecting" || phase === "connected"
          ? "open"
          : phase;

  return (
    <aside className={`alchemy-wire${collapsed ? " alchemy-wire--collapsed" : ""}`}>
      <button
        type="button"
        className="alchemy-wire-toggle"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Show payload" : "Hide payload"}
        aria-expanded={!collapsed}
      >
        {collapsed ? "‹" : "›"}
      </button>

      <header className="alchemy-wire-head">
        <div className="alchemy-wire-title">
          <span>Payload</span>
          <span className={`alchemy-wire-phase alchemy-wire-phase--${phase}`}>{phaseLabel}</span>
        </div>
        <button
          type="button"
          className="alchemy-wire-clear"
          onClick={() => {
            setEntries([]);
            setExpandedId(null);
          }}
        >
          Clear
        </button>
      </header>

      {headerExtra}

      <div className="alchemy-wire-list" ref={listRef}>
        {entries.length === 0 ? (
          <p className="alchemy-wire-empty">Waiting for frames. Join or spin to fill the log.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id}>
              <button
                type="button"
                className={[
                  "alchemy-wire-row",
                  `alchemy-wire-row--${entry.direction}`,
                  entry.isError ? "alchemy-wire-row--error" : "",
                  expandedId === entry.id ? "alchemy-wire-row--open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setExpandedId((prev) => (prev === entry.id ? null : entry.id))}
              >
                <span className="alchemy-wire-dir" aria-hidden="true">
                  {entry.direction === "in" ? "◂" : "▸"}
                </span>
                <span className="alchemy-wire-time">{formatTime(entry.timestamp)}</span>
                <span className="alchemy-wire-summary">
                  {entry.cmdName}
                  {entry.cmd != null ? ` ${entry.cmd}` : ""}
                  {entry.preview ? `  ${entry.preview}` : ""}
                </span>
              </button>
              {expandedId === entry.id ? (
                <pre className="alchemy-wire-json">{formatPayload(entry.payload)}</pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
