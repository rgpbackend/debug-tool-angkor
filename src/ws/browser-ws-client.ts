import {
  getFramePayload,
  hasCmd,
  type WsFrame,
  type WsOutboundFrame,
} from "./protocol";
import {
  isTokenBannedStompError,
  parseStompErrorCode,
  StompTokenBannedError,
} from "./stomp-errors";

export interface BrowserWsClientOptions {
  timeoutMs: number;
}

type PayloadMatcher = (payload: Record<string, unknown>) => boolean;
type PayloadHandler = (payload: Record<string, unknown>) => void;

export interface WaitForPayloadOptions {
  rejectMatcher?: PayloadMatcher;
}
type StompErrorHandler = (code: number) => void;
export type WsDisconnectInfo = { code: number; reason: string };
type DisconnectHandler = (info: WsDisconnectInfo) => void;

interface PayloadListenerRegistration {
  matcher: PayloadMatcher;
  handler: PayloadHandler;
}

type WsInboundMessage =
  | { type: "payload"; payload: Record<string, unknown> }
  | { type: "stomp-error"; code: number };

export class BrowserWsClient {
  private socket: WebSocket | null = null;
  private lastClose: { code: number; reason: string } | null = null;
  private readonly payloadListeners = new Set<PayloadListenerRegistration>();
  private readonly stompErrorListeners = new Set<StompErrorHandler>();
  private readonly disconnectListeners = new Set<DisconnectHandler>();
  private persistentMessageHandler: ((ev: MessageEvent<string | Blob>) => void) | null =
    null;
  private persistentCloseHandler: ((ev: CloseEvent) => void) | null = null;
  private closingIntentionally = false;

  private readonly endpoint: string;
  private readonly options: BrowserWsClientOptions;

  constructor(endpoint: string, options: BrowserWsClientOptions) {
    this.endpoint = endpoint;
    this.options = options;
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.endpoint);
      this.lastClose = null;
      const timer = window.setTimeout(() => {
        socket.close();
        reject(
          new Error(`WS connect timeout after ${this.options.timeoutMs}ms`),
        );
      }, this.options.timeoutMs);

      socket.addEventListener("open", () => {
        window.clearTimeout(timer);
        this.closingIntentionally = false;
        this.socket = socket;
        this.attachPersistentSocketHandlers();
        resolve();
      });

      socket.addEventListener("error", () => {
        window.clearTimeout(timer);
        reject(new Error(`WS connect error to ${this.endpoint}`));
      });

      socket.addEventListener("close", (ev) => {
        this.lastClose = {
          code: ev.code,
          reason: ev.reason || "no reason",
        };
      });
    });
  }

  sendFrame(frame: WsOutboundFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WS is not connected");
    }
    this.socket.send(JSON.stringify(frame));
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getLastCloseInfo(): { code: number; reason: string } | null {
    return this.lastClose;
  }

  addPayloadListener(
    matcher: PayloadMatcher,
    handler: PayloadHandler,
  ): () => void {
    const registration: PayloadListenerRegistration = { matcher, handler };
    this.payloadListeners.add(registration);
    this.attachPersistentSocketHandlers();
    return () => {
      this.payloadListeners.delete(registration);
    };
  }

  addStompErrorListener(handler: StompErrorHandler): () => void {
    this.stompErrorListeners.add(handler);
    this.attachPersistentSocketHandlers();
    return () => {
      this.stompErrorListeners.delete(handler);
    };
  }

  addDisconnectListener(handler: DisconnectHandler): () => void {
    this.disconnectListeners.add(handler);
    this.attachPersistentSocketHandlers();
    return () => {
      this.disconnectListeners.delete(handler);
    };
  }

  waitForPayload(
    matcher: PayloadMatcher,
    label = "response",
    options?: WaitForPayloadOptions,
  ): Promise<Record<string, unknown>> {
    if (!this.socket) {
      return Promise.reject(new Error("WS is not connected"));
    }
    const socket = this.socket;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(
          new Error(`WS ${label} timeout after ${this.options.timeoutMs}ms`),
        );
      }, this.options.timeoutMs);

      const onMessage = (ev: MessageEvent<string | Blob>) => {
        void (async () => {
          try {
            const message = await parseInboundMessage(ev.data);
            if (!message) {
              return;
            }
            if (message.type === "stomp-error") {
              this.dispatchStompError(message.code);
              if (isTokenBannedStompError(message.code)) {
                cleanup();
                reject(new StompTokenBannedError());
              }
              return;
            }
            if (options?.rejectMatcher?.(message.payload)) {
              cleanup();
              reject(new Error(formatCmdErrorMessage(message.payload)));
              return;
            }
            if (matcher(message.payload)) {
              cleanup();
              resolve(message.payload);
            }
          } catch (err) {
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      };

      const onError = () => {
        cleanup();
        reject(new Error(`WS ${label} error`));
      };

      const onClose = (ev: CloseEvent) => {
        cleanup();
        reject(
          new Error(
            `WS closed before expected ${label} (code=${ev.code}, reason=${ev.reason || "no reason"})`,
          ),
        );
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };

      socket.addEventListener("message", onMessage);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });
  }

  close(): void {
    this.closingIntentionally = true;
    this.detachPersistentSocketHandlers();
    this.payloadListeners.clear();
    this.stompErrorListeners.clear();
    this.disconnectListeners.clear();
    this.socket?.close();
    this.socket = null;
    this.closingIntentionally = false;
  }

  private attachPersistentSocketHandlers(): void {
    this.attachPersistentMessageHandler();
    this.attachPersistentCloseHandler();
  }

  private attachPersistentMessageHandler(): void {
    if (!this.socket || this.persistentMessageHandler) {
      return;
    }
    this.persistentMessageHandler = (ev) => {
      void (async () => {
        try {
          const message = await parseInboundMessage(ev.data);
          if (!message) {
            return;
          }
          if (message.type === "stomp-error") {
            this.dispatchStompError(message.code);
            return;
          }
          for (const { matcher, handler } of this.payloadListeners) {
            if (matcher(message.payload)) {
              handler(message.payload);
            }
          }
        } catch {
          // Ignore parse errors for push listeners.
        }
      })();
    };
    this.socket.addEventListener("message", this.persistentMessageHandler);
  }

  private detachPersistentMessageHandler(): void {
    if (this.socket && this.persistentMessageHandler) {
      this.socket.removeEventListener("message", this.persistentMessageHandler);
    }
    this.persistentMessageHandler = null;
  }

  private attachPersistentCloseHandler(): void {
    if (!this.socket || this.persistentCloseHandler) {
      return;
    }
    this.persistentCloseHandler = (ev) => {
      this.lastClose = {
        code: ev.code,
        reason: ev.reason || "no reason",
      };
      if (this.closingIntentionally) {
        return;
      }
      this.detachPersistentMessageHandler();
      this.socket = null;
      this.dispatchDisconnect(this.lastClose);
    };
    this.socket.addEventListener("close", this.persistentCloseHandler);
  }

  private detachPersistentCloseHandler(): void {
    if (this.socket && this.persistentCloseHandler) {
      this.socket.removeEventListener("close", this.persistentCloseHandler);
    }
    this.persistentCloseHandler = null;
  }

  private detachPersistentSocketHandlers(): void {
    this.detachPersistentMessageHandler();
    this.detachPersistentCloseHandler();
  }

  private dispatchDisconnect(info: WsDisconnectInfo): void {
    for (const handler of this.disconnectListeners) {
      handler(info);
    }
  }

  private dispatchStompError(code: number): void {
    for (const handler of this.stompErrorListeners) {
      handler(code);
    }
  }
}

export { StompTokenBannedError } from "./stomp-errors";

export function isSpinResponsePayload(
  payload: Record<string, unknown>,
): boolean {
  if (
    !hasCmd(payload, "1500") ||
    !isObject(payload.spin) ||
    !isObject(payload.round) ||
    !isObject(payload.state)
  ) {
    return false;
  }
  const spin = payload.spin as Record<string, unknown>;
  return isObject(spin.jackpot);
}

/** Spin cmd 1500 error envelope (`c: 1` or `errorCode`). */
export function isSpinErrorPayload(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1500")) {
    return false;
  }
  return payload.c === 1 || payload.errorCode != null;
}

function formatCmdErrorMessage(payload: Record<string, unknown>): string {
  const msg = typeof payload.msg === "string" ? payload.msg.trim() : "";
  const errorCode =
    typeof payload.errorCode === "string" ? payload.errorCode.trim() : "";
  if (errorCode && msg) {
    return `${errorCode}: ${msg}`;
  }
  if (msg) {
    return msg;
  }
  if (errorCode) {
    return errorCode;
  }
  return "Command rejected";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Matches cmd 1005 join/subscribe response. */
export function isJoinResponsePayload(
  payload: Record<string, unknown>,
): boolean {
  if (
    !hasCmd(payload, "1005") ||
    typeof payload.c !== "number" ||
    !Array.isArray(payload.symbols)
  ) {
    return false;
  }
  const first = payload.symbols[0];
  if (first === undefined) {
    return true;
  }
  return (
    typeof first === "object" &&
    first !== null &&
    !Array.isArray(first) &&
    typeof (first as Record<string, unknown>).id === "string"
  );
}

/** Matches cmd 1502 history-list response. */
export function isHistoryListPayload(
  payload: Record<string, unknown>,
): boolean {
  return (
    hasCmd(payload, "1502") &&
    Array.isArray(payload.items) &&
    typeof payload.totalItems === "number" &&
    typeof payload.totalPage === "number"
  );
}

/** Matches cmd 1503 history-detail success (flat spin-step body, no spinId). */
export function isHistoryDetailPayload(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1503")) {
    return false;
  }
  if (payload.c === 1 || payload.errorCode != null) {
    return false;
  }
  return (
    typeof payload.roundId === "string" &&
    Array.isArray(payload.reels) &&
    (typeof payload.spinIndex === "number" ||
      typeof payload.stepIndex === "number")
  );
}

/** Matches cmd 1510 (pull) or 1520 (push) jackpot pools response. */
export function isJackpotPoolsPayload(
  payload: Record<string, unknown>,
): boolean {
  return (
    (hasCmd(payload, "1510") || hasCmd(payload, "1520")) &&
    Array.isArray(payload.pools)
  );
}

/** Matches cmd 1520 server push only. */
export function isJackpotPoolsPushPayload(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1520") && Array.isArray(payload.pools);
}

/** Matches cmd 1511 jackpot win history response. */
export function isJackpotWinHistoryPayload(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1511") && Array.isArray(payload.items);
}

/** Matches cmd 2002 force-jackpot arm response. */
export function isForceJackpotResponse(
  payload: Record<string, unknown>,
): boolean {
  return (
    hasCmd(payload, "2002") &&
    payload.c !== 1 &&
    payload.errorCode == null &&
    typeof payload.tier === "string"
  );
}

/** Matches cmd 1521 jackpot winner broadcast. */
export function isJackpotWinnerPush(
  payload: Record<string, unknown>,
): boolean {
  return (
    hasCmd(payload, "1521") &&
    typeof payload.tier === "string" &&
    typeof payload.winAmount === "string"
  );
}

/** Matches cmd 1530 wallet balance server push. */
export function isWalletBalancePushPayload(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1530")) {
    return false;
  }
  if (payload.c === 1 || payload.errorCode != null) {
    return false;
  }
  const balance = payload.balance;
  if (typeof balance !== "string" || !balance.trim()) {
    return false;
  }
  const reason = payload.reason;
  return (
    reason === "JOIN" || reason === "BET" || reason === "WIN"
  );
}

async function parseInboundMessage(
  raw: string | Blob,
): Promise<WsInboundMessage | null> {
  try {
    const text = typeof raw === "string" ? raw : await raw.text();
    const parsed: unknown = JSON.parse(text);
    const stompCode = parseStompErrorCode(parsed);
    if (stompCode !== null) {
      return { type: "stomp-error", code: stompCode };
    }
    const frame = tryParseFrameFromParsed(parsed);
    if (!frame) {
      return null;
    }
    const payload = getFramePayload(frame);
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      return null;
    }
    return { type: "payload", payload };
  } catch {
    return null;
  }
}

function tryParseFrameFromParsed(parsed: unknown): WsFrame | null {
  if (!Array.isArray(parsed) || parsed.length < 2) {
    return null;
  }
  if (typeof parsed[0] !== "number") {
    return null;
  }
  const payload = parsed.at(-1);
  if (
    Array.isArray(payload) ||
    typeof payload !== "object" ||
    payload === null
  ) {
    return null;
  }
  if (parsed.length === 2) {
    return parsed as WsFrame;
  }
  if (
    typeof parsed[1] === "string" &&
    typeof parsed[2] === "string" &&
    (parsed.length === 4 || parsed.length === 5)
  ) {
    return parsed as WsFrame;
  }
  return null;
}
