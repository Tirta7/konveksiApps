"use client";
import { useEffect, useRef } from "react";
import { subscribeRealtime } from "@/lib/realtime-client";

/**
 * Subscribe to SSE real-time data change events.
 * When the server broadcasts "dataChanged", fires the onSync callback.
 * Uses the shared per-browser connection (see lib/realtime-client).
 * 
 * Usage: useRealtimeSync(() => fetchData());
 */
export function useRealtimeSync(onSync: () => void) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    return subscribeRealtime(() => onSyncRef.current());
  }, []);
}
