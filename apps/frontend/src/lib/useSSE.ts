// useSSE.ts
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
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000); // 1s -> exponentielles Backoff
  const finishedRef = useRef(false); // Track if job is finished to avoid false errors

  useEffect(() => {
    // Don't connect if jobId is empty
    if (!jobId) return;

    // Reset finished state for new job
    finishedRef.current = false;
    let closed = false;

    const url = `${BACKEND_URL}/api/jobs/${jobId}/stream?t=${Date.now()}`; // cache-bust
    const idleMs = opts?.idleMs ?? 20000;
    const hardTimeoutMs = opts?.hardTimeoutMs ?? 10 * 60 * 1000;

    const clearTimers = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (hardRef.current) {
        clearTimeout(hardRef.current);
        hardRef.current = null;
      }
    };

    const scheduleIdleGuard = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // hier kannst du optional einen UI-Hinweis setzen („Reconnecting…")
        try {
          esRef.current?.close();
        } catch {}
        reconnect();
      }, idleMs);
    };

    const reconnect = () => {
      if (closed) return;
      clearTimers();
      // exponentielles Backoff mit Cap
      const wait = Math.min(backoffRef.current, 15000);
      backoffRef.current = Math.min(backoffRef.current * 2, 15000);
      setTimeout(() => {
        if (!closed) open(); // erneut öffnen
      }, wait);
    };

    const open = () => {
      try {
        esRef.current?.close();
      } catch {}
      const es = new EventSource(url, { withCredentials: false });
      esRef.current = es;

      // jedes Event resettet den Idle-Timer
      const touch = () => scheduleIdleGuard();

      es.onopen = () => {
        backoffRef.current = 1000; // Reset Backoff
        touch();
      };

      es.onerror = (_ev) => {
        // ❗ nicht als Fehler werten, wenn schon fertig
        if (!finishedRef.current) {
          // readyState: 0 (connecting), 1 (open), 2 (closed)
          // Browser macht auto-reconnect, aber wir forcieren, falls er zu lange hängt
          if (es.readyState === 2) reconnect();
        } else {
          // Job ist fertig, normaler Verbindungsabschluss
          try {
            es.close();
          } catch {}
        }
      };

      const bind = (type: keyof ListenerMap) => {
        es.addEventListener(type, (ev: MessageEvent) => {
          touch();
          const data = safeParse((ev as MessageEvent).data);
          listeners[type]?.(data, ev);
          if (type === "done") {
            // Job ist abgeschlossen - markieren als fertig
            finishedRef.current = true;
            closed = true;
            clearTimers();
            try {
              es.close();
            } catch {}
          }
        });
      };

      // Standard-"message" als Fallback
      es.onmessage = (ev) => {
        touch();
        listeners.message?.(safeParse(ev.data), ev);
      };

      (
        [
          "status",
          "progress",
          "trace",
          "artifact_written",
          "result",
          "error",
          "done",
        ] as const
      ).forEach(bind);

      // Hard timeout als Failsafe
      if (hardRef.current) clearTimeout(hardRef.current);
      hardRef.current = setTimeout(() => {
        if (!closed) {
          try {
            es.close();
          } catch {}
          reconnect();
        }
      }, hardTimeoutMs);
    };

    const safeParse = (raw: string) => {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    open();
    return () => {
      closed = true;
      clearTimers();
      try {
        esRef.current?.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
}
