"use client";
import { useEffect, useRef } from "react";

/**
 * Subscribe to SSE real-time data change events.
 * When the server broadcasts "dataChanged", fires the onSync callback.
 * 
 * Usage: useRealtimeSync(() => fetchData());
 */
export function useRealtimeSync(onSync: () => void) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/events");

      es.addEventListener("dataChanged", () => {
        onSyncRef.current();
      });

      es.onerror = () => {
        es.close();
        // Auto-reconnect after 3s if connection drops
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);
}
