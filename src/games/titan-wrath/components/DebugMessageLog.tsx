import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { BrowserWsClient } from "../../../ws/browser-ws-client";
import type { WsOutboundFrame } from "../../../ws/protocol";

const MAX_ENTRIES = 200;

type LogEntry = {
  id: number;
  direction: "in" | "out";
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
  1501: "BALANCE_UPDATE",
  1502: "JACKPOT_TRIGGERED",
  1503: "GAME_HISTORY_LIST",
  1504: "GAME_HISTORY_DETAIL",
  1505: "JACKPOT_WIN_HISTORY",
  1506: "POOL_BALANCE_CHANGED",
  2001: "DEBUG_CHEAT_GRID",
  2002: "DEBUG_CHEAT_JACKPOT",
};

function isHeartbeatFrame(frame: WsOutboundFrame): boolean {
  // Heartbeat: ["7", "MiniGame", "1", counter] — first element is string "7"
  return frame[0] === "7";
}

function extractCmd(frame: WsOutboundFrame): number | null {
  // frame[3] is the payload object for [6, zone, route, payload]
  const payload = frame[3] as Record<string, unknown> | undefined;
  if (payload?.cmd != null) return Number(payload.cmd);
  // [number, Record] form
  const direct = frame[1] as Record<string, unknown> | undefined;
  if (direct?.cmd != null) return Number(direct.cmd);
  return null;
}

function outboundPreview(frame: WsOutboundFrame): string {
  const payload = (frame[3] ?? frame[1]) as Record<string, unknown> | undefined;
  if (!payload) return "";
  const cmd = payload.cmd;
  const parts: string[] = [];
  if (cmd === 1500 && typeof payload.betAmount === "number") parts.push(`betAmount=${payload.betAmount}`);
  if (typeof payload.superBet === "boolean") parts.push(`superBet=${payload.superBet}`);
  return parts.join(" ");
}

function inboundPreview(payload: Record<string, unknown>): string {
  const cmd = payload.cmd;
  const c = payload.c;
  const isErr = typeof c === "number" && c !== 0;
  const parts: string[] = [];

  if (isErr) {
    if (typeof payload.mgs === "string") parts.push(`mgs=${payload.mgs}`);
    return `ERROR c=${c} ${parts.join(" ")}`;
  }

  if (cmd === 1500 || cmd === "1500") {
    const spin = payload.spin as Record<string, unknown> | undefined;
    if (spin) {
      parts.push(`${spin.spinType ?? "?"}`);
      if (typeof spin.spinIndex === "number") parts.push(`#${spin.spinIndex}`);
      if (typeof spin.winAmount === "number") parts.push(`win=${spin.winAmount}`);
    }
    const round = payload.round as Record<string, unknown> | undefined;
    if (round?.state) parts.push(`round=${round.state}`);
  }
  if (cmd === 1501 || cmd === "1501") {
    if (typeof payload.balance === "string") parts.push(`balance=${payload.balance}`);
  }
  if (cmd === 1502 || cmd === "1502") {
    if (typeof payload.tier === "string") parts.push(`tier=${payload.tier}`);
    if (typeof payload.prizeAmount === "string") parts.push(`prize=${payload.prizeAmount}`);
  }
  if (cmd === 1005 || cmd === "1005") {
    parts.push("config");
    if (Array.isArray(payload.symbols)) parts.push(`${payload.symbols.length} symbols`);
  }
  if (cmd === 1006 || cmd === "1006") {
    parts.push("session evicted");
  }
  if (cmd === 1506 || cmd === "1506") {
    if (typeof payload.grand === "string") parts.push(`grand=${payload.grand}`);
    if (typeof payload.major === "string") parts.push(`major=${payload.major}`);
  }
  if (cmd === 1503 || cmd === "1503") {
    if (typeof payload.count === "number") parts.push(`${payload.count} spins`);
  }
  if (cmd === 1504 || cmd === "1504") {
    if (typeof payload.spinType === "string") parts.push(payload.spinType);
  }
  if (cmd === 1505 || cmd === "1505") {
    if (typeof payload.count === "number") parts.push(`${payload.count} winners`);
  }
  return parts.join(" ");
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function formatPayload(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

interface DebugMessageLogProps {
  clientRef: RefObject<BrowserWsClient | null>;
  sessionReady: boolean;
}

export default function DebugMessageLog({ clientRef, sessionReady }: DebugMessageLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const nextIdRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const pushEntry = useCallback((entry: Omit<LogEntry, "id">) => {
    const id = nextIdRef.current++;
    setEntries((prev) => {
      const next = [...prev, { ...entry, id }];
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
  }, []);

  // Intercept inbound via onInbound callback
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    const prev = client.options;
    const orig = prev.onInbound;
    prev.onInbound = (payload) => {
      // Skip heartbeat receipts / non-command messages (no cmd field)
      if (payload.cmd === undefined || payload.cmd === null) {
        orig?.(payload);
        return;
      }
      const cmd = typeof payload.cmd === "number" ? payload.cmd : Number(payload.cmd);
      const isErr = typeof payload.c === "number" && payload.c !== 0;
      pushEntry({
        direction: "in",
        timestamp: Date.now(),
        cmd: Number.isNaN(cmd) ? null : cmd,
        cmdName: CMD_NAMES[cmd] ?? `CMD_${cmd}`,
        preview: inboundPreview(payload),
        payload,
        isError: isErr,
      });
      orig?.(payload);
    };
    return () => {
      prev.onInbound = orig;
    };
  }, [clientRef, pushEntry, sessionReady]);

  // Intercept outbound via monkey-patching sendFrame
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    const origSend = client.sendFrame.bind(client);
    client.sendFrame = (frame: WsOutboundFrame) => {
      // Skip heartbeat / ping-pong frames
      if (!isHeartbeatFrame(frame)) {
        const cmd = extractCmd(frame);
        pushEntry({
          direction: "out",
          timestamp: Date.now(),
          cmd,
          cmdName: cmd != null ? (CMD_NAMES[cmd] ?? `CMD_${cmd}`) : "?",
          preview: outboundPreview(frame),
          payload: frame,
          isError: false,
        });
      }
      origSend(frame);
    };
    return () => {
      client.sendFrame = origSend;
    };
  }, [clientRef, pushEntry, sessionReady]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [entries, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setAutoScroll(atBottom);
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <>
      <div className="debug-log-container" ref={containerRef} onScroll={handleScroll}>
        {entries.length === 0 ? (
          <div className="debug-empty">No messages yet</div>
        ) : (
          <div className="debug-log-list">
            {entries.map((entry) => (
              <div key={entry.id}>
                <div
                  className={`debug-log-entry dir-${entry.direction}${entry.isError ? " is-error" : ""}${expandedId === entry.id ? " expanded" : ""}`}
                  onClick={() => toggleExpand(entry.id)}
                >
                  <span className="debug-log-dir">{entry.direction === "in" ? "←" : "→"}</span>
                  <span className="debug-log-time">{formatTime(entry.timestamp)}</span>
                  <span className="debug-log-summary">
                    {entry.cmdName}({entry.cmd}){" "}{entry.preview}
                  </span>
                </div>
                {expandedId === entry.id && (
                  <div className="debug-log-expand">{formatPayload(entry.payload)}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {!autoScroll && entries.length > 0 && (
          <button className="debug-log-scroll-btn" onClick={() => { setAutoScroll(true); }}>
            ↓ Latest
          </button>
        )}
      </div>
    </>
  );
}
