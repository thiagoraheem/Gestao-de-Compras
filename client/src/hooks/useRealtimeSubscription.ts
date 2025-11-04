import { useEffect } from "react";
import { realtimeClient, type RealtimeEventMessage } from "@/lib/realtimeClient";

export function useRealtimeSubscription(
  channel: string,
  handler: (event: RealtimeEventMessage) => void,
) {
  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe(channel, handler);
    return () => {
      unsubscribe();
    };
  }, [channel, handler]);
}
