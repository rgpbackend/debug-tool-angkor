import { getFramePayload, hasCmd, type WsFrame, type WsOutboundFrame } from "./protocol";

export interface BrowserWsClientOptions {
  timeoutMs: number;
}

export class BrowserWsClient {
  private socket: WebSocket | null = null;
  private lastClose: { code: number; reason: string } | null = null;

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
        this.socket = socket;
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

  waitForPayload(
    matcher: (payload: Record<string, unknown>) => boolean,
    label = "response",
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
            const frame = await tryParseFrame(ev.data);
            if (!frame) {
              return;
            }
            const payload = getFramePayload(frame);
            if (
              !payload ||
              Array.isArray(payload) ||
              typeof payload !== "object"
            ) {
              return;
            }
            if (matcher(payload)) {
              cleanup();
              resolve(payload);
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
    this.socket?.close();
    this.socket = null;
  }
}

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function tryParseFrame(raw: string | Blob): Promise<WsFrame | null> {
  try {
    const text = typeof raw === "string" ? raw : await raw.text();
    const parsed: unknown = JSON.parse(text);
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
  } catch {
    return null;
  }
}
