// useSSE.ts - Robust SSE with exponential backoff
import { useEffect, useRef } from "react";

type ListenerMap = Partial<
  Record<
    | "status"
    | "progress"
    | "trace"
    | "artifact_written"
    | "result"
    | "error"
    | "done"
    | "message"
    | "connection_lost",
    (data?: any, ev?: MessageEvent) => void
  >
>;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "https://aigilexperience-backend.onrender.com";

// Core SSE connection logic - robust against Safari/WebKit timeouts + Render.com proxy
export function startSSE(
  url: string,
  handlers: {
    onStatus?: (x: any) => void;
    onProgress?: (x: any) => void;
    onArtifact?: (x: any) => void;
    onResult?: (x: any) => void;
    onDone?: (x: any) => void;
    onError?: (x: any) => void;
    onConnectionLost?: () => void;
  },
) {
  let es: EventSource | null = null;
  let stopped = false;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 8; // nach 8 fehlschlägen: Connection Lost
  let backoff = 1000; // 1s
  const backoffMax = 20000; // 20s
  let lastTick = Date.now();
  let jobCompleted = false;

  const touch = () => {
    lastTick = Date.now();
    backoff = 1000;
    reconnectAttempts = 0; // Reset nach erfolgreichem Event
  };

  const connect = () => {
    if (stopped) return;

    console.log(
      `[SSE] Connecting to ${url}, attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`,
    );

    es = new EventSource(url);

    // Handle open/established connection
    es.onopen = () => {
      console.log("[SSE] Connection opened");
      touch();
    };

    es.addEventListener("status", (e) => {
      touch();
      const data = JSON.parse((e as MessageEvent).data);
      if (data.status === "completed" || data.status === "failed") {
        jobCompleted = true;
      }
      handlers.onStatus?.(data);
    });

    es.addEventListener("progress", (e) => {
      touch();
      handlers.onProgress?.(JSON.parse((e as MessageEvent).data));
    });

    es.addEventListener("artifact_written", (e) => {
      touch();
      handlers.onArtifact?.(JSON.parse((e as MessageEvent).data));
    });

    es.addEventListener("result", (e) => {
      touch();
      jobCompleted = true;
      handlers.onResult?.(JSON.parse((e as MessageEvent).data));
    });

    es.addEventListener("done", (e) => {
      touch();
      jobCompleted = true;
      handlers.onDone?.(JSON.parse((e as MessageEvent).data));
      es?.close();
      stopped = true;
    });

    es.addEventListener("error", (e) => {
      touch();
      jobCompleted = true;
      handlers.onError?.(JSON.parse((e as MessageEvent).data));
    });

    es.onerror = (event) => {
      console.log("[SSE] Connection error", {
        readyState: es?.readyState,
        event,
      });
      es?.close();

      if (stopped || jobCompleted) return;

      reconnectAttempts++;

      // Nach zu vielen Fehlversuchen: Connection Lost nur wenn Job nicht beendet
      if (reconnectAttempts >= maxReconnectAttempts && !jobCompleted) {
        console.log(
          "[SSE] Max reconnect attempts reached, marking as connection lost",
        );
        handlers.onConnectionLost?.();
        stopped = true;
        return;
      }

      // Sonst: reconnect mit backoff
      console.log(
        `[SSE] Reconnecting in ${backoff}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
      );
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, backoffMax);
    };
  };

  // Idle-Guard: wenn 30s kein Event (inkl. Heartbeat) ankam → reconnect
  const idle = setInterval(() => {
    if (!stopped && Date.now() - lastTick > 30000) {
      es?.close();
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, backoffMax);
    }
  }, 5000);

  connect();

  return () => {
    stopped = true;
    clearInterval(idle);
    es?.close();
  };
}

export function useSSE(
  jobId: string,
  listeners: ListenerMap,
  opts?: {
    // max Zeit ohne Event bevor wir das UI als "verloren" markieren
    idleMs?: number;
    // hartes Limit für Verbindungsdauer (Failsafe)
    hardTimeoutMs?: number;
  },
) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Don't connect if jobId is empty
    if (!jobId) return;

    const url = `${BACKEND_URL}/api/jobs/${jobId}/stream?t=${Date.now()}`; // cache-bust

    // Use the robust startSSE function
    const cleanup = startSSE(url, {
      onStatus: listeners.status,
      onProgress: listeners.progress,
      onArtifact: listeners.artifact_written,
      onResult: listeners.result,
      onDone: listeners.done,
      onError: listeners.error,
      onConnectionLost: listeners.connection_lost,
    });

    cleanupRef.current = cleanup;

    return cleanup;
    // eslint-disable-next-line
  }, [jobId]);
}
