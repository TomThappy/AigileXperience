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
    | "message",
    (data: any, ev?: MessageEvent) => void
  >
>;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "https://aigilexperience-backend.onrender.com";

// Core SSE connection logic - robust against Safari/WebKit timeouts
export function startSSE(url: string, handlers: {
  onStatus?: (x: any) => void;
  onProgress?: (x: any) => void;
  onArtifact?: (x: any) => void;
  onResult?: (x: any) => void;
  onDone?: (x: any) => void;
  onError?: (x: any) => void;
}) {
  let es: EventSource | null = null;
  let stopped = false;
  let backoff = 1000; // 1s
  const backoffMax = 15000; // 15s
  let lastTick = Date.now();
  const touch = () => {
    lastTick = Date.now();
    backoff = 1000;
  };

  const connect = () => {
    if (stopped) return;
    es = new EventSource(url);
    es.addEventListener("status", (e) => {
      touch();
      handlers.onStatus?.(JSON.parse((e as MessageEvent).data));
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
      handlers.onResult?.(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("done", (e) => {
      touch();
      handlers.onDone?.(JSON.parse((e as MessageEvent).data));
      es?.close();
      stopped = true;
    });
    es.onerror = () => {
      // nicht sofort „Connection lost" zeigen – erst reconnecten
      es?.close();
      if (stopped) return;
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
    });

    cleanupRef.current = cleanup;

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
}
